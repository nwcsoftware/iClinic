import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'
import {
  type Lang, LANG_NAME, detectLang, KEYWORDS as LANG_KEYWORDS, EMERGENCY as LANG_EMERGENCY,
  CORRECTIONS, PATTERNS, POOLS as LANG_POOLS, EMERGENCY_TEXT, DISCLAIMER,
  specialtyName, stripNonMedical,
} from '@/lib/triage-lang'

// ---------------------------------------------------------------------------
// AI triage assistant v3 — SPECIALTY NAVIGATION ONLY.
//  - Adapts when the patient changes their mind ("no wait, it's a headache")
//  - Varied, conversational replies (never the same template twice in a row)
//  - Handles greetings / thanks / off-topic questions gracefully
//  - Light emoji use inside the chat
//  - Persists every message to triage_sessions / triage_messages
//  - NEVER gives medical advice; emergencies always route to emergency care
// ---------------------------------------------------------------------------

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Urgency = 'routine' | 'soon' | 'urgent' | 'emergency'

interface TriageResult {
  reply: string
  ready: boolean
  specialty_slug: string | null
  urgency: Urgency
  emergency: boolean
  summary: string
}

type Specialty = { id: string; slug: string; name: string; description: string | null }

function pick<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length]
}

// Red flags are checked in EVERY language — a patient may switch mid-chat.
function detectEmergency(text: string): boolean {
  const t = text.toLowerCase()
  return (['en', 'fr', 'ar'] as Lang[]).some((l) => LANG_EMERGENCY[l].some((p) => t.includes(p)))
}

function hasCorrection(text: string): boolean {
  const t = text.toLowerCase()
  const hit = (['en', 'fr', 'ar'] as Lang[]).some((l) => CORRECTIONS[l].some((p) => t.includes(p)))
  return hit || /^no+[\s,.!]/.test(t.trim()) || /^لا+[\s،,.!]/.test(t.trim())
}

// The text window that matters: everything the user said AFTER their last
// correction. "I have stomach pain... no nooo I have a headache" -> headache.
function effectiveUserText(messages: ChatMessage[]): { text: string; corrected: boolean } {
  const userMsgs = messages.filter((m) => m.role === 'user')
  let lastCorrection = -1
  for (let i = 0; i < userMsgs.length; i++) {
    if (hasCorrection(userMsgs[i].content)) lastCorrection = i
  }
  if (lastCorrection >= 0) {
    return { text: userMsgs.slice(lastCorrection).map((m) => m.content).join(' '), corrected: true }
  }
  return { text: userMsgs.map((m) => m.content).join(' '), corrected: false }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Matching rules: short words (≤4 chars) must be whole words with optional
// plural — so 'foot' never matches "football" and 'arm' never matches "army".
// Longer words match as prefixes so 'itch' still covers "itching".
//
// \b is defined by [A-Za-z0-9_], so it never fires around Arabic script —
// those keywords are matched as plain substrings instead.
function matchesKeyword(word: string, text: string): boolean {
  if (/[؀-ۿ]/.test(word)) return text.includes(word)
  const core = escapeRe(word)
  const re = word.length <= 4 && !word.includes(' ')
    ? new RegExp(`\\b${core}s?\\b`)
    : new RegExp(`\\b${core}`)
  return re.test(text)
}

// Scores across ALL languages, so a patient can mix languages freely.
function classifyByKeywords(text: string, catalog: Specialty[]): string | null {
  const t = stripNonMedical(text.toLowerCase())
  const scores = new Map<string, number>()
  for (const lang of ['en', 'fr', 'ar'] as Lang[]) {
    for (const [slug, words] of Object.entries(LANG_KEYWORDS[lang])) {
      if (!catalog.some((s) => s.slug === slug)) continue
      let score = 0
      for (const w of words) {
        if (matchesKeyword(w, t)) score += w.includes(' ') ? 2 : 1
      }
      if (score > 0) scores.set(slug, (scores.get(slug) ?? 0) + score)
    }
  }
  if (scores.size === 0) return null
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// Did the assistant's previous message already recommend a specialty?
// (Reply pools that recommend always contain the specialty display name.)
function lastRecommendedName(messages: ChatMessage[], catalog: Specialty[], lang: Lang): string | null {
  const lastBot = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''
  for (const s of catalog) {
    const localized = specialtyName(s.slug, s.name, lang)
    if (lastBot.includes(localized) || lastBot.includes(s.name)) return localized
  }
  return null
}

function keywordFallback(messages: ChatMessage[], catalog: Specialty[], lang: Lang): TriageResult {
  const { text, corrected } = effectiveUserText(messages)
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const emergency = detectEmergency(text)
  const seed = messages.length * 7 + last.length
  const botAskedBefore = messages.filter((m) => m.role === 'assistant').length > 1
  const gpName = specialtyName('general_practice', catalog.find((s) => s.slug === 'general_practice')?.name ?? 'General Practitioner', lang)
  const nameOf = (slug: string | null) =>
    specialtyName(slug, catalog.find((s) => s.slug === slug)?.name ?? gpName, lang)
  const prevRecName = lastRecommendedName(messages, catalog, lang)
  const P = LANG_POOLS[lang]
  const RE = PATTERNS[lang]

  const base: Omit<TriageResult, 'reply'> = {
    ready: false, specialty_slug: null, urgency: 'routine', emergency: false, summary: text.slice(0, 280),
  }

  // Recency first: what does THIS message say, then the whole (post-correction) window.
  const lastSignal = classifyByKeywords(last, catalog)
  const windowSignal = classifyByKeywords(text, catalog)

  // Serious-illness worries (cancer, tumor...) get an empathetic route, never a cheery template.
  if (!emergency && RE.serious.test(last)) {
    const slug = lastSignal ?? 'general_practice'
    const name = nameOf(slug)
    return { ...base, ready: true, specialty_slug: slug, reply: pick(P.serious, seed)(name) }
  }

  if (!emergency && !lastSignal) {
    // ── Intent analysis: the latest message names no specialty-level symptom.
    // Route by what it actually is; NEVER recommend a specialty off of it.
    if (RE.greeting.test(last.trim())) return { ...base, reply: pick(P.greeting, seed)() }
    if (RE.thanks.test(last)) return { ...base, reply: pick(P.thanks, seed)() }
    if (RE.ack.test(last.trim())) return { ...base, reply: pick(P.ack, seed)() }
    if (RE.capabilities.test(last)) return { ...base, reply: pick(P.capabilities, seed)() }
    if (RE.advice.test(last)) {
      // Advice/diagnosis request: refuse. Point back at the specialty if we know it.
      if (windowSignal) {
        const name = nameOf(windowSignal)
        return {
          ...base, ready: true, specialty_slug: windowSignal,
          reply: `${pick(P.noAdvice, seed)()} ${pick(P.sameAgain, seed)(name)}`,
        }
      }
      return { ...base, reply: pick(P.noAdvice, seed)() }
    }

    const lastBot = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? ''
    const answeringOurQuestion = lastBot.trim().endsWith('?')
    const medicalHint = RE.medicalHint.test(last)

    // Non-medical message (and not an answer to a question we just asked):
    // say what this bot is for. No specialty, no doctors.
    if (!medicalHint && !answeringOurQuestion) {
      return { ...base, reply: pick(P.identity, seed)() }
    }

    // Health-related but too vague to classify:
    if (medicalHint && prevRecName) return { ...base, reply: pick(P.newComplaint, seed)() }
    if (!botAskedBefore) return { ...base, reply: pick(P.clarify, seed)() }
    // We already asked once and it's still vague — fall through to GP below.
  }

  if (!emergency && lastSignal && RE.advice.test(last)) {
    // Symptom + treatment question in one message: refuse advice, still route.
    const name = nameOf(lastSignal)
    return {
      ...base, ready: true, specialty_slug: lastSignal,
      reply: `${pick(P.noAdvice, seed)()} ${pick(P.sameAgain, seed)(name)}`,
    }
  }

  // Latest message wins over older context; fall back to window, then GP.
  const slug = lastSignal ?? windowSignal ?? catalog.find((s) => s.slug === 'general_practice')?.slug ?? catalog[0]?.slug ?? null
  const name = nameOf(slug)

  if (emergency) {
    return {
      ...base, ready: true, specialty_slug: slug, urgency: 'emergency', emergency: true,
      reply: EMERGENCY_TEXT[lang](name),
    }
  }

  // Same specialty as the previous recommendation: acknowledge instead of re-pitching.
  if (prevRecName === name && !corrected) {
    return { ...base, ready: true, specialty_slug: slug, reply: pick(P.sameAgain, seed)(name) }
  }

  const template = corrected ? pick(P.corrected, seed) : pick(P.recommend, seed)
  return { ...base, ready: true, specialty_slug: slug, reply: template(name) }
}

// ---------------------------------------------------------------------------
// Claude classifier
// ---------------------------------------------------------------------------
async function claudeTriage(messages: ChatMessage[], catalog: Specialty[], lang: Lang): Promise<TriageResult> {
  const client = new Anthropic()
  const slugs = catalog.map((s) => s.slug)
  const catalogText = catalog.map((s) => `- ${s.slug} (${s.name}): ${s.description ?? ''}`).join('\n')

  const system = `You are the friendly triage assistant of a clinic's booking app. Your ONLY job: work out which MEDICAL SPECIALTY the patient should see, and be a pleasant conversational companion while doing it.

HARD RULES — never break these:
- NEVER give medical advice, diagnosis, treatment, medication names, home remedies, or reassurance about severity ("it's probably nothing"). If asked, warmly refuse and redirect to finding the right specialist.
- NEVER name a specific doctor. Recommend the SPECIALTY only (the app shows doctor cards separately).
- ALWAYS write "reply" in ${LANG_NAME[lang]} (the language the patient selected in the app). If they write in another language, still answer in ${LANG_NAME[lang]} unless they clearly switch — then follow them.

CONVERSATION STYLE:
- ALWAYS analyze the message first: is it a symptom, a correction, a question about you, an advice request, small talk, or something non-medical? Respond to what it actually is — never answer a non-symptom message with a specialty recommendation.
- If the message has NO medical content at all (weather, sports, jokes, random questions), tell them — in varied wording — that you are a bot trained to help them pick the right doctor, and invite them to describe a symptom. ready=false, specialty_slug=null for these.
- Warm, human, brief (1-3 sentences). Light emoji use is welcome (1-2 per message, never in emergencies... except the initial warning symbol).
- NEVER repeat a sentence structure you already used in this conversation — vary your openings and phrasing every time.
- If the patient CHANGES THEIR MIND or corrects themselves ("no wait, actually my head hurts"), drop the earlier complaint completely and work with the newest one. Acknowledge the switch naturally.
- If they mention a possibly serious condition (cancer, tumor), lead with empathy — no cheerfulness — and route them to the right specialty for proper testing.
- Ask at most ONE clarifying question when you genuinely can't pick a specialty; after that, decide (general_practice for vague cases).

SPECIALTY CHOICE — you MUST pick from these slugs only:
${catalogText}

EMERGENCIES (severe chest pain/pressure, trouble breathing, stroke signs, severe bleeding, loss of consciousness, seizures, severe allergic reaction, suicidal thoughts): set emergency=true, urgency="emergency"; the reply FIRST tells them to call the local emergency number / go to the nearest emergency department NOW, then names the follow-up specialty. No emojis except 🚨, no other advice.

When giving the final recommendation set ready=true; state the specialty in the reply and add a short note that this is guidance, not a diagnosis. While clarifying or chatting set ready=false and specialty_slug=null.

Respond with ONLY one JSON object, no markdown fences:
{"reply": string, "ready": boolean, "specialty_slug": one of [${slugs.map((s) => `"${s}"`).join(', ')}] or null, "urgency": "routine"|"soon"|"urgent"|"emergency", "emergency": boolean, "summary": string (one neutral sentence for the doctor about the CURRENT complaint)}`

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 700,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  let raw = textBlock && 'text' in textBlock ? textBlock.text.trim() : '{}'
  raw = raw.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const parsed = JSON.parse(raw) as TriageResult
  if (parsed.specialty_slug && !slugs.includes(parsed.specialty_slug)) {
    parsed.specialty_slug = null
    parsed.ready = false
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Doctors + persistence helpers
// ---------------------------------------------------------------------------
async function topDoctors(admin: ReturnType<typeof createAdminClient>, slug: string, limit = 3) {
  const withRating = await admin
    .from('public_doctors')
    .select('id, full_name, specialty, specialty_slug, specialty_name, avatar_url, rating, review_count')
    .eq('specialty_slug', slug)
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(limit)
  if (!withRating.error) return withRating.data ?? []
  const plain = await admin
    .from('public_doctors')
    .select('id, full_name, specialty, specialty_slug, specialty_name, avatar_url')
    .eq('specialty_slug', slug)
    .limit(limit)
  return plain.data ?? []
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : []
    let sessionId: string | null = typeof body.session_id === 'string' ? body.session_id : null
    const appLang: Lang = ['en', 'fr', 'ar'].includes(body.lang) ? body.lang : 'en'
    if (messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const user = await getBearerUser(request, admin) // optional — persistence needs it

    const { data: catalogData } = await admin
      .from('specialties').select('id, slug, name, description').eq('is_active', true)
    const catalog = (catalogData ?? []) as Specialty[]

    // ── Session: create or continue ─────────────────────────────────────────
    let isNewSession = false
    if (user) {
      if (sessionId) {
        const { data: s } = await admin
          .from('triage_sessions').select('id').eq('id', sessionId).eq('user_id', user.id).maybeSingle()
        if (!s) sessionId = null
      }
      if (!sessionId) {
        const { data: created } = await admin
          .from('triage_sessions')
          .insert({ user_id: user.id, status: 'active' })
          .select('id').single()
        sessionId = created?.id ?? null
        isNewSession = true
      }
    }

    // Persist incoming user message(s): all of them for a fresh session,
    // otherwise just the newest one.
    if (sessionId) {
      const toStore = isNewSession
        ? messages
        : messages.slice(-1).filter((m) => m.role === 'user')
      if (toStore.length > 0) {
        await admin.from('triage_messages').insert(
          toStore.map((m) => ({ session_id: sessionId, role: m.role, content: m.content }))
        )
      }
    }

    // ── Classify ────────────────────────────────────────────────────────────
    // Answer in the app's language, unless the patient clearly writes another.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    const lang: Lang = detectLang(lastUser, appLang)

    let result: TriageResult
    if (process.env.ANTHROPIC_API_KEY) {
      try { result = await claudeTriage(messages, catalog, lang) }
      catch (e) { console.error('claudeTriage error, using fallback:', e); result = keywordFallback(messages, catalog, lang) }
    } else {
      result = keywordFallback(messages, catalog, lang)
    }

    // Safety net: red-flag scan over the post-correction window.
    const { text: windowText } = effectiveUserText(messages)
    if (detectEmergency(windowText) && !result.emergency) {
      result.emergency = true
      result.urgency = 'emergency'
      result.reply = `${EMERGENCY_TEXT[lang]("").trim()} ${result.reply}`
    }

    // ── Doctors for the recommendation ──────────────────────────────────────
    let doctors: unknown[] = []
    if (result.ready && result.specialty_slug) {
      doctors = await topDoctors(admin, result.specialty_slug, 3)
      if (doctors.length === 0) {
        const gp = await topDoctors(admin, 'general_practice', 3)
        if (gp.length > 0) {
          const gpName = specialtyName('general_practice', catalog.find((s) => s.slug === 'general_practice')?.name ?? 'General Practitioner', lang)
          const seed = messages.length * 7
          result.reply = `${result.reply} ${pick(LANG_POOLS[lang].notOffered, seed)(gpName)}`
          doctors = gp
        }
      }
    }

    // ── Persist assistant reply + session metadata ──────────────────────────
    if (sessionId) {
      await admin.from('triage_messages').insert({ session_id: sessionId, role: 'assistant', content: result.reply })
      const spec = catalog.find((s) => s.slug === result.specialty_slug)
      await admin.from('triage_sessions').update({
        recommended_specialty_id: spec?.id ?? null,
        recommended_specialty_text: spec?.name ?? null,
        urgency: result.urgency,
        summary: result.summary || null,
        updated_at: new Date().toISOString(),
      }).eq('id', sessionId)
    }

    return NextResponse.json({ ...result, doctors, session_id: sessionId })
  } catch (err) {
    console.error('triage error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
