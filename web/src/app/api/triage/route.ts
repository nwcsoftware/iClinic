import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

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

const EMERGENCY_PATTERNS = [
  'chest pain', 'chest pressure', "can't breathe", 'cant breathe', 'difficulty breathing',
  'short of breath', 'shortness of breath', 'stroke', 'face droop', 'slurred speech',
  'severe bleeding', 'bleeding heavily', 'unconscious', 'passed out', 'fainted',
  'suicid', 'kill myself', 'end my life', 'overdose', 'seizure', 'convulsion',
  'anaphyla', 'severe allergic', 'throat closing', 'poisoned', 'severe head injury',
]

// Phrases that signal the patient is correcting / replacing what they said.
const CORRECTION_PATTERNS = [
  'no no', 'nooo', 'no wait', 'wait no', 'actually', 'i mean', 'i meant', 'not that',
  'forget that', 'forget what i said', 'scratch that', 'instead', 'changed my mind',
  'sorry i', 'correction', 'rather',
]

const KEYWORDS: Record<string, string[]> = {
  dermatology: ['skin', 'rash', 'acne', 'pimple', 'mole', 'eczema', 'psoriasis', 'itch', 'hives', 'wart', 'hair loss', 'dandruff', 'nail', 'dry skin', 'sunburn'],
  cardiology: ['heart', 'chest', 'palpitation', 'blood pressure', 'hypertension', 'cholesterol', 'irregular heartbeat', 'racing heart'],
  pediatrics: ['my child', 'my baby', 'my kid', 'my son', 'my daughter', 'infant', 'toddler', 'newborn'],
  orthopedics: ['bone', 'joint', 'knee', 'shoulder', 'back pain', 'neck pain', 'fracture', 'sprain', 'sports injury', 'hip', 'ankle', 'wrist', 'arthritis', 'muscle pain', 'elbow'],
  gynecology: ['pregnan', 'period', 'menstrual', 'menstruation', 'pcos', 'ovar', 'vaginal', 'fertility', 'contracept', 'menopause'],
  otolaryngology: ['ear', 'hearing', 'sinus', 'sore throat', 'tonsil', 'nose bleed', 'nosebleed', 'snoring', 'hoarse', 'blocked nose', 'stuffy nose', 'ringing'],
  ophthalmology: ['eye', 'vision', 'blurry', 'blurred', 'seeing spots', 'red eye', 'dry eye', 'glasses'],
  psychiatry: ['anxiety', 'anxious', 'depress', 'panic', 'stress', 'mental health', 'mood', 'insomnia', 'trouble sleeping', 'sleep problem', "can't sleep", 'cant sleep', 'burnout', 'adhd', 'ocd'],
  dentistry: ['tooth', 'teeth', 'gum', 'cavity', 'toothache', 'dental', 'wisdom'],
  neurology: ['headache', 'migraine', 'dizz', 'vertigo', 'numb', 'tingling', 'tremor', 'memory', 'fainting spells', 'nerve pain'],
  gastroenterology: ['stomach', 'abdominal', 'belly', 'nausea', 'vomit', 'diarrhea', 'constipat', 'reflux', 'heartburn', 'bloat', 'ibs', 'bowel', 'indigestion', 'gas '],
  endocrinology: ['diabet', 'thyroid', 'hormone', 'blood sugar', 'weight gain', 'weight loss'],
  urology: ['urin', 'bladder', 'prostate', 'uti', 'pee', 'erectile', 'testic'],
  nephrology: ['kidney'],
  pulmonology: ['cough', 'asthma', 'wheez', 'lung', 'bronchitis', 'phlegm', 'congestion'],
  rheumatology: ['lupus', 'autoimmune', 'joint stiffness', 'stiff joints', 'inflammation', 'rheumat'],
  allergy_immunology: ['allerg', 'hay fever', 'pollen', 'sneezing', 'food reaction', 'dust'],
  general_practice: ['fever', 'flu', 'cold', 'tired', 'fatigue', 'checkup', 'check-up', 'general', 'unwell', 'sick', 'body ache'],
}

// ---------------------------------------------------------------------------
// Reply pools — varied phrasings so the bot never sounds canned. Variant is
// picked from conversation state so consecutive answers differ.
// ---------------------------------------------------------------------------
const POOLS = {
  recommend: [
    (n: string) => `Thanks for telling me. From what you describe, ${n} is the right specialty for this 👍 I've lined up the top-rated doctors below — this is guidance, not a diagnosis.`,
    (n: string) => `Got it. That sounds like something a ${n} specialist should look at 🩺 Here are the best-rated doctors for it — remember, I guide you to the right door, I don't diagnose.`,
    (n: string) => `Understood! The specialty that fits this best is ${n}. Take a look at the top doctors below 👇 (I can't give medical advice — a doctor will assess you properly.)`,
    (n: string) => `Okay, that points to ${n} 🎯 I've pulled up the highest-rated doctors for you below. This is direction, not a diagnosis.`,
    (n: string) => `That's one for ${n}. You'll find the top-rated doctors below — book whichever suits you best 😊 (Guidance only, not medical advice.)`,
    (n: string) => `Based on what you shared, I'd point you to ${n} 🧭 Below are our best-rated doctors for it. A proper assessment happens at the visit.`,
  ],
  corrected: [
    (n: string) => `No problem — updated! ✅ For that, ${n} is the right specialty. Top-rated doctors are below.`,
    (n: string) => `Got you — ignoring the earlier one. This points to ${n} instead 🔄 Here are the best doctors for it.`,
    (n: string) => `Thanks for clarifying 🙌 In that case you'll want ${n}. I've refreshed the doctor list below.`,
    (n: string) => `Ah, that changes things — ${n} it is 👍 Doctors below are updated for you.`,
  ],
  clarify: [
    () => `I want to point you to the right specialist 🙂 Can you tell me a bit more — where exactly do you feel it, and since when?`,
    () => `Happy to help! To match you well, tell me the main thing bothering you — for example where it hurts or what feels off.`,
    () => `Let's narrow it down 🔍 What's the main symptom, and how long has it been going on?`,
    () => `Could you give me one more detail? Where in your body do you feel it — or is it more about mood, sleep, or energy?`,
  ],
  greeting: [
    () => `Hello! 👋 I'm your health assistant. Tell me what's bothering you and I'll point you to the right specialist.`,
    () => `Hi there 😊 Describe your symptoms — even in a few words — and I'll match you with the right specialty.`,
    () => `Hey! I'm here to help you find the right doctor. What's going on with your health today?`,
  ],
  thanks: [
    () => `Anytime! 😊 If anything else comes up, just describe it and I'll point you to the right specialist.`,
    () => `You're welcome! Wishing you a smooth visit 🌟 I'm here whenever you need me.`,
    () => `Glad I could help 🙌 Take care — and don't hesitate to come back.`,
  ],
  capabilities: [
    () => `I'm the clinic's health assistant 🩺 Describe your symptoms and I'll figure out which specialty you need and show you our top-rated doctors — then you can book in a couple of taps. One thing I never do is give medical advice or diagnoses.`,
    () => `My job is simple: you tell me how you feel, I tell you which type of doctor to see, and show you the best-rated ones to book 📅 I don't diagnose or give treatment advice — that's for your doctor.`,
  ],
  noAdvice: [
    () => `I can't give medical advice or suggest treatments — that's a doctor's job 🙏 What I can do is get you to the right one: tell me your symptoms and I'll match the specialty.`,
    () => `That's something only a doctor should answer, so I won't guess 🙅 But describe what you're feeling and I'll point you to the right specialist right away.`,
  ],
  offTopic: [
    () => `Good question — but I'm best at one thing: matching symptoms to the right specialist 😄 Tell me how you're feeling and I'll take it from there.`,
    () => `I'll stay in my lane on that one 🙂 I'm your health navigator — describe any symptom and I'll find you the right doctor.`,
    () => `I wish I could chat about everything! My specialty is finding YOUR specialist 🧭 What's bothering you health-wise?`,
  ],
  notOffered: [
    (n: string) => `Honest note: we don't currently have that exact specialist at this clinic 😕 A ${n} can assess you and refer you onward — top-rated ones are below.`,
    (n: string) => `We don't have that specialty in-house right now. Best next step: see a ${n} here — they can evaluate and refer you. Doctors below 👇`,
  ],
}

function pick<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length]
}

function detectEmergency(text: string): boolean {
  const t = text.toLowerCase()
  return EMERGENCY_PATTERNS.some((p) => t.includes(p))
}

function hasCorrection(text: string): boolean {
  const t = text.toLowerCase()
  return CORRECTION_PATTERNS.some((p) => t.includes(p)) || /^no+[\s,.!]/.test(t.trim())
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

function classifyByKeywords(text: string, catalog: Specialty[]): string | null {
  const t = ` ${text.toLowerCase()} `
  const scores = new Map<string, number>()
  for (const [slug, words] of Object.entries(KEYWORDS)) {
    if (!catalog.some((s) => s.slug === slug)) continue
    let score = 0
    for (const w of words) if (t.includes(w)) score += w.includes(' ') ? 2 : 1
    if (score > 0) scores.set(slug, score)
  }
  if (scores.size === 0) return null
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

const GREETING_RE = /^(hi|hii+|hello|hey|heyy+|good (morning|afternoon|evening)|salam|marhaba|bonjour|yo)\b[\s!.,]*$/i
const THANKS_RE = /\b(thanks|thank you|thx|shukran|merci|appreciate)\b/i
const CAPABILITIES_RE = /\b(who are you|what can you do|what are you|how do you work|what is this|help me understand)\b/i
const ADVICE_RE = /\b(what (medicine|medication|drug|pill)|which (medicine|medication|drug|pill)|should i take|prescribe|home remedy|remedies|how (do|to) (i )?(treat|cure|fix)|is it (serious|dangerous|cancer)|do i have)\b/i

function keywordFallback(messages: ChatMessage[], catalog: Specialty[]): TriageResult {
  const { text, corrected } = effectiveUserText(messages)
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const emergency = detectEmergency(text)
  const seed = messages.length * 7 + last.length
  const botAskedBefore = messages.filter((m) => m.role === 'assistant').length > 1

  const base: Omit<TriageResult, 'reply'> = {
    ready: false, specialty_slug: null, urgency: 'routine', emergency: false, summary: text.slice(0, 280),
  }

  // Recency first: what does THIS message say, then the whole (post-correction) window.
  const lastSignal = classifyByKeywords(last, catalog)
  const windowSignal = classifyByKeywords(text, catalog)

  if (!emergency && !lastSignal) {
    // The latest message has no symptom content — handle it as conversation.
    if (GREETING_RE.test(last.trim())) return { ...base, reply: pick(POOLS.greeting, seed)() }
    if (THANKS_RE.test(last)) return { ...base, reply: pick(POOLS.thanks, seed)() }
    if (CAPABILITIES_RE.test(last)) return { ...base, reply: pick(POOLS.capabilities, seed)() }
    if (ADVICE_RE.test(last)) {
      if (windowSignal) {
        const name = catalog.find((s) => s.slug === windowSignal)?.name ?? 'General Practitioner'
        return {
          ...base, ready: true, specialty_slug: windowSignal,
          reply: `${pick(POOLS.noAdvice, seed)()} For what you described, ${name} is the right specialty — doctors below 👇`,
        }
      }
      return { ...base, reply: pick(POOLS.noAdvice, seed)() }
    }
    if (!windowSignal) {
      // Nothing medical anywhere yet: clarify once, then default to GP.
      if (!botAskedBefore) {
        return { ...base, reply: last.trim().endsWith('?') ? pick(POOLS.offTopic, seed)() : pick(POOLS.clarify, seed)() }
      }
    }
  }

  if (!emergency && lastSignal && ADVICE_RE.test(last)) {
    // Symptom + treatment question in one message: refuse advice, still route.
    const name = catalog.find((s) => s.slug === lastSignal)?.name ?? 'General Practitioner'
    return {
      ...base, ready: true, specialty_slug: lastSignal,
      reply: `${pick(POOLS.noAdvice, seed)()} For what you described, ${name} is the right specialty — doctors below 👇`,
    }
  }

  // Latest message wins over older context; fall back to window, then GP.
  const slug = lastSignal ?? windowSignal ?? catalog.find((s) => s.slug === 'general_practice')?.slug ?? catalog[0]?.slug ?? null
  const name = catalog.find((s) => s.slug === slug)?.name ?? 'General Practitioner'

  if (emergency) {
    return {
      ...base, ready: true, specialty_slug: slug, urgency: 'emergency', emergency: true,
      reply: `🚨 Some of what you described can be serious. Please call your local emergency number or go to the nearest emergency department now. For follow-up care afterwards, ${name} is the right specialty — but emergency care comes first.`,
    }
  }

  const template = corrected ? pick(POOLS.corrected, seed) : pick(POOLS.recommend, seed)
  return { ...base, ready: true, specialty_slug: slug, reply: template(name) }
}

// ---------------------------------------------------------------------------
// Claude classifier
// ---------------------------------------------------------------------------
async function claudeTriage(messages: ChatMessage[], catalog: Specialty[]): Promise<TriageResult> {
  const client = new Anthropic()
  const slugs = catalog.map((s) => s.slug)
  const catalogText = catalog.map((s) => `- ${s.slug} (${s.name}): ${s.description ?? ''}`).join('\n')

  const system = `You are the friendly triage assistant of a clinic's booking app. Your ONLY job: work out which MEDICAL SPECIALTY the patient should see, and be a pleasant conversational companion while doing it.

HARD RULES — never break these:
- NEVER give medical advice, diagnosis, treatment, medication names, home remedies, or reassurance about severity ("it's probably nothing"). If asked, warmly refuse and redirect to finding the right specialist.
- NEVER name a specific doctor. Recommend the SPECIALTY only (the app shows doctor cards separately).
- Reply in the language the patient writes in.

CONVERSATION STYLE:
- Warm, human, brief (1-3 sentences). Light emoji use is welcome (1-2 per message, never in emergencies... except the initial warning symbol).
- NEVER repeat a sentence structure you already used in this conversation — vary your openings and phrasing every time.
- If the patient CHANGES THEIR MIND or corrects themselves ("no wait, actually my head hurts"), drop the earlier complaint completely and work with the newest one. Acknowledge the switch naturally.
- Greetings, thanks, jokes, off-topic questions: respond briefly and cleverly like a good receptionist would, then steer back to their health. Do not force a specialty for non-medical messages (ready=false).
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
    let result: TriageResult
    if (process.env.ANTHROPIC_API_KEY) {
      try { result = await claudeTriage(messages, catalog) }
      catch (e) { console.error('claudeTriage error, using fallback:', e); result = keywordFallback(messages, catalog) }
    } else {
      result = keywordFallback(messages, catalog)
    }

    // Safety net: red-flag scan over the post-correction window.
    const { text: windowText } = effectiveUserText(messages)
    if (detectEmergency(windowText) && !result.emergency) {
      result.emergency = true
      result.urgency = 'emergency'
      result.reply = `🚨 Some of what you described can be serious. Please call your local emergency number or go to the nearest emergency department now. ${result.reply}`
    }

    // ── Doctors for the recommendation ──────────────────────────────────────
    let doctors: unknown[] = []
    if (result.ready && result.specialty_slug) {
      doctors = await topDoctors(admin, result.specialty_slug, 3)
      if (doctors.length === 0) {
        const gp = await topDoctors(admin, 'general_practice', 3)
        if (gp.length > 0) {
          const gpName = catalog.find((s) => s.slug === 'general_practice')?.name ?? 'General Practitioner'
          const seed = messages.length * 7
          result.reply = `${result.reply} ${pick(POOLS.notOffered, seed)(gpName)}`
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
