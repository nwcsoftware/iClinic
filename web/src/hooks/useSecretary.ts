'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Everything a secretary screen needs to know: whose practice they are looking
// at, and which of that doctor's workplaces they may touch.
//
// The active doctor is remembered between visits, because a secretary who
// works Tuesdays for one doctor should not have to re-pick them every time.
// It is validated against the list on load, so a doctor who removed them stops
// being selectable rather than lingering as a stale choice.
//
// Nothing here decides permission. The server does that on every request; this
// only decides what to ask for.
// ---------------------------------------------------------------------------

export type SecretaryDoctor = {
  link_id: string
  doctor_id: string
  full_name: string
  specialty: string | null
  avatar_url: string | null
}

export type SecretaryLocation = {
  doctor_location_id: string
  location_id: string
  name: string
  type: string
  city: string | null
  address: string | null
  working_days: number[]
  working_hours: Record<string, { start: string; end: string }>
  appointment_duration: number | null
}

const REMEMBERED = 'iclinic.secretary.activeDoctor'

export function useSecretary() {
  const supabase = createClient()
  const [doctors, setDoctors] = useState<SecretaryDoctor[]>([])
  const [locations, setLocations] = useState<SecretaryLocation[]>([])
  const [activeDoctorId, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [supabase])

  const load = useCallback(async (wanted?: string | null) => {
    setLoading(true)
    try {
      let remembered = wanted
      if (remembered === undefined) {
        try { remembered = localStorage.getItem(REMEMBERED) } catch { remembered = null }
      }
      const q = remembered ? `?doctor_id=${encodeURIComponent(remembered)}` : ''
      const res = await fetch(`/api/secretary/me${q}`, { headers: await authHeader() })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load your account')

      setDoctors(body.doctors ?? [])
      setLocations(body.locations ?? [])
      setActive(body.active_doctor_id ?? null)
      // The server answers with a doctor it is willing to serve, so store that
      // rather than what was asked for.
      try {
        if (body.active_doctor_id) localStorage.setItem(REMEMBERED, body.active_doctor_id)
        else localStorage.removeItem(REMEMBERED)
      } catch { /* private browsing */ }
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { load(undefined) }, [load])

  // Switching doctor reloads permissions from the server. Nothing from the
  // previous doctor is carried across, which is the whole point.
  const switchDoctor = useCallback((doctorId: string) => load(doctorId), [load])

  const activeDoctor = doctors.find((d) => d.doctor_id === activeDoctorId) ?? null

  return {
    doctors, locations, activeDoctorId, activeDoctor,
    loading, error, switchDoctor, reload: () => load(activeDoctorId), authHeader,
  }
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Labels for the statuses a secretary may set. `no_show` is "not completed". */
export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  no_show: 'Not completed',
  cancelled: 'Cancelled',
}

export const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  scheduled: { bg: 'var(--icl-brand-soft)', fg: 'var(--icl-brand-dark)' },
  confirmed: { bg: 'var(--icl-doc-soft)', fg: 'var(--icl-doc-dark)' },
  in_progress: { bg: 'var(--icl-amber-bg)', fg: 'var(--icl-amber)' },
  completed: { bg: 'var(--icl-success-bg)', fg: 'var(--icl-success)' },
  no_show: { bg: 'var(--icl-danger-bg)', fg: 'var(--icl-danger)' },
  cancelled: { bg: '#EEF1F6', fg: 'var(--icl-muted)' },
}
