import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// TESTING login: fixed username/password pairs mapped to real accounts.
// Mints a genuine Supabase session so the rest of the app works normally.
// Replace with the real auth system before launch.
const CREDENTIALS: Record<string, { password: string; email: string }> = {
  doctor: { password: 'doctor123', email: 'dr.lara.haddad@iclinic.demo' },
  patient: { password: 'patient123', email: 'scorpion666999@hotmail.com' },
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Disabled in production' }, { status: 403 })
  }
  try {
    const body = await request.json().catch(() => ({}))
    const username = String(body.username ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    const entry = CREDENTIALS[username]
    if (!entry || entry.password !== password) {
      return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const email = entry.email

    // A magiclink generateLink creates the account if it does not exist, and
    // verifying the OTP below confirms the address — so the createUser call
    // that used to run first was redundant on every login, not just returning
    // ones. It cost about 1.2s each time, and for an existing account its only
    // product was an "already registered" error that was then discarded.
    //
    // The retry is kept as a genuine fallback rather than removed: if a future
    // version of generateLink stops auto-creating, first-time sign-in still
    // works. It runs only on failure, so it costs nothing in the normal case.
    let { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email })

    if (linkErr) {
      const { error: createErr } = await admin.auth.admin.createUser({ email, email_confirm: true })
      if (createErr && !/already|registered|exists/i.test(createErr.message)) {
        return NextResponse.json({ error: createErr.message }, { status: 400 })
      }
      ;({ data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email }))
    }

    const otp = link?.properties?.email_otp
    if (linkErr || !otp) {
      return NextResponse.json({ error: linkErr?.message ?? 'Could not sign in' }, { status: 400 })
    }

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({ email, token: otp, type: 'email' })
    if (verifyErr || !verified.session) {
      return NextResponse.json({ error: verifyErr?.message ?? 'Sign in failed' }, { status: 400 })
    }

    return NextResponse.json({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    })
  } catch (err) {
    console.error('simple-login error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
