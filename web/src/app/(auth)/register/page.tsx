'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Stethoscope, Loader2, ArrowLeft, Eye, EyeOff, AlertCircle, Check } from 'lucide-react'
import OtpDialog from '@/components/otp-dialog'

// ---------------------------------------------------------------------------
// Doctor registration.
//
// Same tokens as the patient app, so someone arriving from iclinic.health does
// not feel handed off to a different product halfway through signing up.
//
// The password rules are shown as they are met rather than as an error after
// submitting, because "must be 8 characters" is more useful before you have
// typed 6 than after.
// ---------------------------------------------------------------------------

const PATIENT_APP = 'https://iclinic.health'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', specialty: '', phone: '', email: '', password: '', confirm: '',
  })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    if (error) setError('')
  }

  const longEnough = form.password.length >= 8
  const matches = form.password.length > 0 && form.password === form.confirm

  async function handleResendOtp() {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Could not send another code.')
  }

  async function handleRegister(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!matches) { setError('The two passwords do not match.'); return }
    if (!longEnough) { setError('Use at least 8 characters for the password.'); return }
    setLoading(true)

    try {
      const res = await fetch('/api/register-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          specialty: form.specialty || undefined,
          phone: form.phone || undefined,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not create that account.')

      setOtpEmail(form.email)
      setOtpOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="icl flex min-h-screen flex-col items-center justify-center px-5 py-10"
      style={{ background: 'var(--icl-bg)' }}
    >
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="icl-sub mb-5 inline-flex items-center gap-1.5"
          style={{ color: 'var(--icl-muted)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center"
            style={{ background: 'var(--icl-brand)', borderRadius: 20, boxShadow: 'var(--icl-shadow-raised)' }}
          >
            <Stethoscope className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4" style={{ fontSize: 26, fontWeight: 800, color: 'var(--icl-ink)', letterSpacing: '-0.5px' }}>
            Create a doctor account
          </h1>
          <p className="icl-sub mt-1.5 max-w-sm">
            Set your hours, take bookings around the clock, and see a patient&apos;s history before
            they sit down.
          </p>
        </div>

        <div className="icl-card p-6 sm:p-7">
          <form onSubmit={handleRegister} className="space-y-4">
            <Field label="Full name">
              <input className="icl-input" required autoComplete="name" placeholder="Dr. Lara Haddad"
                value={form.full_name} onChange={set('full_name')} disabled={loading} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Specialty" hint="Optional">
                <input className="icl-input" placeholder="Cardiology"
                  value={form.specialty} onChange={set('specialty')} disabled={loading} />
              </Field>
              <Field label="Phone" hint="Optional">
                <input className="icl-input" autoComplete="tel" placeholder="+961 …"
                  value={form.phone} onChange={set('phone')} disabled={loading} />
              </Field>
            </div>

            <Field label="Email">
              <input className="icl-input" type="email" required autoComplete="email"
                placeholder="you@clinic.com" value={form.email} onChange={set('email')} disabled={loading} />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  className="icl-input pr-11"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={set('password')}
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
            </Field>

            <Field label="Confirm password">
              <input
                className="icl-input"
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Type it again"
                value={form.confirm}
                onChange={set('confirm')}
                disabled={loading}
                aria-invalid={form.confirm.length > 0 && !matches}
              />
            </Field>

            {/* Met as you type, rather than as a complaint after submitting. */}
            {form.password.length > 0 ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Rule ok={longEnough}>At least 8 characters</Rule>
                <Rule ok={matches}>Both passwords match</Rule>
              </div>
            ) : null}

            {error ? (
              <div className="flex items-start gap-2 p-3"
                style={{ background: 'var(--icl-danger-bg)', borderRadius: 'var(--icl-r-md)' }}>
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
              Create account
            </button>
          </form>

          <p className="icl-small mt-5 text-center">
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: 'var(--icl-brand)', fontWeight: 700 }}>Terms</Link> and{' '}
            <Link href="/privacy" style={{ color: 'var(--icl-brand)', fontWeight: 700 }}>Privacy Policy</Link>.
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="icl-small">Looking to book an appointment instead?</p>
          <a href={PATIENT_APP} className="icl-sub" style={{ color: 'var(--icl-brand)', fontWeight: 700 }}>
            Open the patient app
          </a>
        </div>
      </div>

      <OtpDialog
        open={otpOpen}
        email={otpEmail}
        onSuccess={() => { setOtpOpen(false); router.push('/dashboard') }}
        onResend={handleResendOtp}
        onClose={() => setOtpOpen(false)}
      />
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="icl-label mb-1.5 block">
        {label}{hint ? <span className="icl-small font-normal"> · {hint}</span> : null}
      </span>
      {children}
    </label>
  )
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{ fontSize: 12.5, fontWeight: 600, color: ok ? 'var(--icl-success)' : 'var(--icl-faint)' }}
    >
      <Check className="h-3.5 w-3.5" style={{ opacity: ok ? 1 : 0.35 }} />
      {children}
    </span>
  )
}
