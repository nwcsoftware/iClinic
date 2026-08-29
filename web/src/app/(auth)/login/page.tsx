'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Stethoscope, UserCog, Loader2, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'
import OtpDialog from '@/components/otp-dialog'

// ---------------------------------------------------------------------------
// Staff sign-in.
//
// Styled from the iClinic tokens so it is recognisably the same product as the
// patient app: same blue, same card radius, same weights, same font stack.
// The behaviour is unchanged — password sign-in, a role check against the
// profile, and the OTP dialog when the account needs confirming.
//
// The role tabs say Doctor and Secretary. The database value is still
// `receptionist`, which is what the check compares against.
// ---------------------------------------------------------------------------

const PATIENT_APP = 'https://iclinic.health'

type Role = 'doctor' | 'receptionist'

const ROLES: { key: Role; label: string; icon: typeof Stethoscope; blurb: string }[] = [
  { key: 'doctor', label: 'Doctor', icon: Stethoscope, blurb: 'Your patients, schedule and prescriptions.' },
  { key: 'receptionist', label: 'Secretary', icon: UserCog, blurb: 'The diary for the places you manage.' },
]

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('doctor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  // The dialog asks for a fresh code when the first one expires or never
  // arrived; the same endpoint the registration flow uses.
  async function resendCode() {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Could not send another code.')
  }

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      // Supabase says "Email not confirmed" for an account that exists but has
      // never verified, which is a different problem from a wrong password.
      if (/not confirmed/i.test(authError.message)) {
        setOtpEmail(email)
        setOtpOpen(true)
        setLoading(false)
        return
      }
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles').select('role, is_active').eq('id', data.user.id).single()

    if (!profile) {
      setError('We could not find a staff profile for that account.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (!profile.is_active) {
      setError('That account has been deactivated. Ask the doctor who added you.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (profile.role !== role) {
      const actual = profile.role === 'receptionist' ? 'secretary' : profile.role
      setError(`That account is a ${actual}. Choose ${actual} above and try again.`)
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  const active = ROLES.find((r) => r.key === role)!

  return (
    <div
      className="icl flex min-h-screen flex-col items-center justify-center px-5 py-10"
      style={{ background: 'var(--icl-bg)' }}
    >
      {/* Brand */}
      <div className="mb-7 flex flex-col items-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center"
          style={{ background: 'var(--icl-brand)', borderRadius: 20, boxShadow: 'var(--icl-shadow-raised)' }}
        >
          <Stethoscope className="h-8 w-8 text-white" />
        </div>
        <h1 className="mt-4" style={{ fontSize: 30, fontWeight: 800, color: 'var(--icl-ink)', letterSpacing: '-0.6px' }}>
          iClinic
        </h1>
        <p className="icl-sub mt-1">The right doctor, in minutes</p>
      </div>

      <div className="icl-card w-full max-w-md p-6 sm:p-7">
        {/* Role */}
        <div
          className="mb-5 grid grid-cols-2 gap-1 p-1"
          style={{ background: 'var(--icl-bg)', borderRadius: 'var(--icl-r-md)' }}
        >
          {ROLES.map((r) => {
            const on = r.key === role
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => { setRole(r.key); setError('') }}
                className="flex items-center justify-center gap-2 py-2.5 transition-colors"
                style={{
                  borderRadius: 'var(--icl-r-sm)',
                  background: on ? 'var(--icl-card)' : 'transparent',
                  boxShadow: on ? 'var(--icl-shadow-card)' : 'none',
                  color: on ? 'var(--icl-brand)' : 'var(--icl-muted)',
                  fontSize: 14.5, fontWeight: 700,
                }}
              >
                <r.icon className="h-4 w-4" />
                {r.label}
              </button>
            )
          })}
        </div>
        <p className="icl-small mb-5 text-center">{active.blurb}</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="icl-label mb-1.5 block">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="icl-input"
              placeholder="you@clinic.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError('') }}
              disabled={loading}
            />
          </label>

          <label className="block">
            <span className="icl-label mb-1.5 block">Password</span>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                className="icl-input pr-11"
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                {showPass
                  ? <EyeOff className="h-4 w-4" style={{ color: 'var(--icl-faint)' }} />
                  : <Eye className="h-4 w-4" style={{ color: 'var(--icl-faint)' }} />}
              </button>
            </div>
          </label>

          {error ? (
            <div
              className="flex items-start gap-2 p-3"
              style={{ background: 'var(--icl-danger-bg)', borderRadius: 'var(--icl-r-md)' }}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--icl-danger)' }} />
              <span className="icl-sub" style={{ color: 'var(--icl-danger)' }}>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="icl-btn icl-btn-primary flex w-full items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>

        <p className="icl-sub mt-5 text-center">
          New here?{' '}
          <Link href="/register" style={{ color: 'var(--icl-brand)', fontWeight: 700 }}>
            Create a doctor account
          </Link>
        </p>
      </div>

      {/* Patients use the app, not this portal. */}
      <div className="mt-6 w-full max-w-md text-center">
        <p className="icl-small">Are you a patient?</p>
        <a
          href={PATIENT_APP}
          className="icl-btn icl-btn-ghost mt-2 inline-flex w-full items-center justify-center gap-2"
        >
          Open the patient app
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      <OtpDialog
        open={otpOpen}
        email={otpEmail}
        onSuccess={() => { setOtpOpen(false); router.push('/dashboard') }}
        onResend={resendCode}
        onClose={() => setOtpOpen(false)}
      />
    </div>
  )
}
