'use client'

import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Loader2, Mail, ShieldCheck } from 'lucide-react'

interface OtpDialogProps {
  open: boolean
  email: string
  onSuccess: () => void
  onResend: () => Promise<void>
  onClose: () => void
}

const OTP_LENGTH = 4

export default function OtpDialog({ open, email, onSuccess, onResend, onClose }: OtpDialogProps) {
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(300)
  const [locked, setLocked] = useState(false)
  const [lockMinutes, setLockMinutes] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const inputs = useRef<(HTMLInputElement | null)[]>([])

  // 5-minute countdown resets each time dialog opens
  useEffect(() => {
    if (!open) return
    setCountdown(300)
    const id = setInterval(() => setCountdown(c => (c <= 1 ? (clearInterval(id), 0) : c - 1)), 1000)
    return () => clearInterval(id)
  }, [open])

  // Lock countdown
  useEffect(() => {
    if (!locked || !lockedUntil) return
    const id = setInterval(() => {
      const msLeft = lockedUntil.getTime() - Date.now()
      if (msLeft <= 0) { setLocked(false); setLockedUntil(null); clearInterval(id); return }
      setLockMinutes(Math.ceil(msLeft / 60000))
    }, 1000)
    setLockMinutes(Math.ceil((lockedUntil.getTime() - Date.now()) / 60000))
    return () => clearInterval(id)
  }, [locked, lockedUntil])

  // Reset on open
  useEffect(() => {
    if (open) {
      setDigits(Array(OTP_LENGTH).fill(''))
      setError('')
      setLoading(false)
      setTimeout(() => inputs.current[0]?.focus(), 100)
    }
  }, [open])

  function handleChange(i: number, val: string) {
    const ch = val.replace(/[^0-9]/g, '').slice(-1)
    const next = [...digits]
    next[i] = ch
    setDigits(next)
    if (ch && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus()
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (text.length === OTP_LENGTH) {
      setDigits(text.split(''))
      inputs.current[OTP_LENGTH - 1]?.focus()
    }
  }

  async function handleVerify() {
    const token = digits.join('')
    if (token.length !== OTP_LENGTH) { setError(`Please enter all ${OTP_LENGTH} digits.`); return }
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
    const body = await res.json()

    if (res.ok) { onSuccess(); return }

    if (body.locked) {
      setLocked(true)
      setLockedUntil(body.locked_until ? new Date(body.locked_until) : new Date(Date.now() + 30 * 60 * 1000))
    } else if (body.expired) {
      setCountdown(0)
    }
    setError(body.error ?? 'Verification failed.')
    setLoading(false)
  }

  async function handleResend() {
    setLoading(true)
    setError('')
    try {
      await onResend()
      setDigits(Array(OTP_LENGTH).fill(''))
      setCountdown(300)
      setLocked(false)
      setLockedUntil(null)
      inputs.current[0]?.focus()
    } catch {
      setError('Failed to resend code. Please try again.')
    }
    setLoading(false)
  }

  return (
    <Dialog
      open={open}
      modal={true}
      disablePointerDismissal={true}
      onOpenChange={(o, eventDetails) => {
        if (!o && eventDetails.reason === 'escape-key') return
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>Verify your identity</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <Mail className="w-4 h-4 shrink-0 mt-0.5" />
            <span>A 4-digit code was sent to <strong className="break-all">{email}</strong></span>
          </div>

          {locked ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-3">
                Too many failed attempts. Please wait <strong>{lockMinutes} minute(s)</strong> before trying again.
              </p>
              <Button variant="outline" className="w-full" onClick={onClose}>
                Go back
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    disabled={loading}
                    className="w-14 text-center text-2xl font-mono font-bold rounded-lg border border-input bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                    style={{ height: '3.5rem' }}
                  />
                ))}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 text-center">
                  {error}
                </p>
              )}

              <div className="text-center text-sm">
                {countdown > 0 ? (
                  <span className="text-slate-500">
                    Code expires in{' '}
                    <span className="font-semibold text-slate-700 tabular-nums">
                      {String(Math.floor(countdown / 60)).padStart(2, '0')}:{String(countdown % 60).padStart(2, '0')}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="text-blue-600 hover:underline font-medium disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleVerify}
                disabled={loading || digits.join('').length !== OTP_LENGTH}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
