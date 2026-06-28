'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Stethoscope, Loader2, ArrowLeft } from 'lucide-react'
import OtpDialog from '@/components/otp-dialog'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ full_name: '', specialty: '', phone: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleRegister(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
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

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Registration failed.'); setLoading(false); return }

      // Send OTP for email verification
      const otpRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      const otpBody = await otpRes.json()

      if (!otpRes.ok) { setError(otpBody.error ?? 'Failed to send verification code.'); setLoading(false); return }

      setOtpEmail(form.email)
      setLoading(false)
      setOtpOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otpEmail }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error ?? 'Failed to resend code.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">

        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg">
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Create Doctor Account</h1>
          <p className="text-slate-500 text-sm">Fill in your details to get started</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Doctor Registration</CardTitle>
            <CardDescription>Your account will be verified by email before proceeding.</CardDescription>
          </CardHeader>

          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full Name <span className="text-red-500">*</span></Label>
                <Input id="full_name" placeholder="Dr. Ahmed Al-Rashid" value={form.full_name} onChange={set('full_name')} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input id="specialty" placeholder="Dermatology" value={form.specialty} onChange={set('specialty')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="+966 5x xxx xxxx" value={form.phone} onChange={set('phone')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email <span className="text-red-500">*</span></Label>
                <Input id="email" type="email" placeholder="doctor@clinic.com" value={form.email} onChange={set('email')} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password <span className="text-red-500">*</span></Label>
                <Input id="password" type="password" placeholder="Min 8 characters" value={form.password} onChange={set('password')} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password <span className="text-red-500">*</span></Label>
                <Input id="confirm" type="password" placeholder="Repeat password" value={form.confirm} onChange={set('confirm')} required />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
              <Link href="/login" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-3 h-3" /> Back to Login
              </Link>
            </CardFooter>
          </form>
        </Card>

      </div>

      <OtpDialog
        open={otpOpen}
        email={otpEmail}
        onSuccess={() => { setOtpOpen(false); router.push('/dashboard') }}
        onResend={handleResendOtp}
        onClose={() => { setOtpOpen(false) }}
      />
    </div>
  )
}
