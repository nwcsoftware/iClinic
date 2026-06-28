'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Stethoscope, UserRound, ClipboardList, Loader2 } from 'lucide-react'
import OtpDialog from '@/components/otp-dialog'

type Role = 'doctor' | 'receptionist'

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('doctor')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpOpen, setOtpOpen] = useState(false)
  const [otpEmail, setOtpEmail] = useState('')

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Verify the profile role matches selected role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      setError('Profile not found. Please contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile.role !== role) {
      setError(`This account is registered as a ${profile.role}, not a ${role}.`)
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!profile.is_active) {
      setError('Your account has been deactivated. Please contact your administrator.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // Credentials valid — sign out temporary session and trigger OTP
    await supabase.auth.signOut()

    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const body = await res.json()

    if (!res.ok) {
      setError(body.error ?? 'Failed to send verification code.')
      setLoading(false)
      return
    }

    setOtpEmail(email)
    setLoading(false)
    setOtpOpen(true)
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

        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 shadow-lg">
            <Stethoscope className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Clinic System</h1>
          <p className="text-slate-500 text-sm">Sign in to your account</p>
        </div>

        {/* Role selector */}
        <Tabs value={role} onValueChange={(v) => { setRole(v as Role); setError('') }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="doctor" className="flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              Doctor
            </TabsTrigger>
            <TabsTrigger value="receptionist" className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Doctor Assistant
            </TabsTrigger>
          </TabsList>

          {(['doctor', 'receptionist'] as Role[]).map((r) => (
            <TabsContent key={r} value={r}>
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">
                    {r === 'doctor' ? 'Doctor Login' : 'Doctor Assistant Login'}
                  </CardTitle>
                  <CardDescription>
                    {r === 'doctor'
                      ? 'Access your patients, appointments, and prescriptions.'
                      : 'Manage appointments and finances for your assigned doctors.'}
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@clinic.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {error}
                      </p>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-3">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Sign In
                    </Button>
                    {r === 'doctor' && (
                      <p className="text-sm text-slate-500 text-center">
                        New doctor?{' '}
                        <Link href="/register" className="text-blue-600 hover:underline font-medium">
                          Create an account
                        </Link>
                      </p>
                    )}
                    {r === 'receptionist' && (
                      <p className="text-xs text-slate-400 text-center">
                        Assistant accounts are created by your assigned doctor.
                      </p>
                    )}
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        {/* Patient redirect */}
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-gradient-to-br from-blue-50 to-slate-100 text-xs text-slate-400">
                Are you a patient?
              </span>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/patient/login">
              <Button variant="outline" className="w-full max-w-md gap-2">
                <UserRound className="w-4 h-4" />
                Open Patient App
              </Button>
            </Link>
          </div>
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
