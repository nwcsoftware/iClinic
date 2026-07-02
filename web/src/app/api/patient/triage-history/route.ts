import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBearerUser } from '@/lib/patient-auth'

// GET /api/patient/triage-history   (Bearer auth)
// The patient's most recent chat session with all messages, plus the
// recommended-specialty doctors so the chat restores exactly as they left it.
export async function GET(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session } = await admin
      .from('triage_sessions')
      .select('id, status, recommended_specialty_id, summary')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) return NextResponse.json({ session_id: null, messages: [], doctors: [], summary: '' })

    const { data: msgs } = await admin
      .from('triage_messages')
      .select('role, content, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
      .limit(200)

    // Restore the doctor cards if the session ended on a recommendation.
    let doctors: unknown[] = []
    if (session.recommended_specialty_id) {
      const { data: spec } = await admin
        .from('specialties').select('slug').eq('id', session.recommended_specialty_id).maybeSingle()
      if (spec?.slug) {
        const withRating = await admin
          .from('public_doctors')
          .select('id, full_name, specialty, specialty_slug, specialty_name, avatar_url, rating, review_count')
          .eq('specialty_slug', spec.slug)
          .order('rating', { ascending: false, nullsFirst: false })
          .limit(3)
        doctors = withRating.error
          ? (await admin.from('public_doctors').select('id, full_name, specialty, specialty_slug, specialty_name, avatar_url').eq('specialty_slug', spec.slug).limit(3)).data ?? []
          : withRating.data ?? []
      }
    }

    return NextResponse.json({
      session_id: session.id,
      messages: (msgs ?? []).map((m) => ({ role: m.role, content: m.content })),
      doctors,
      summary: session.summary ?? '',
    })
  } catch (err) {
    console.error('triage-history error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/patient/triage-history — close the active chat (start fresh).
// History stays stored; the session is just marked completed.
export async function DELETE(request: Request) {
  try {
    const admin = createAdminClient()
    const user = await getBearerUser(request, admin)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await admin
      .from('triage_sessions')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'active')

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('triage-history DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
