'use client'

import { useEffect, useState } from 'react'
import { Building2, Loader2, Check } from 'lucide-react'
import { useSecretary, DAY_NAMES, DAY_SHORT, type SecretaryLocation } from '@/hooks/useSecretary'
import ContextBar from './ContextBar'
import { Skeleton, Message, NoDoctors } from './Appointments'

// ---------------------------------------------------------------------------
// The doctor's availability, for the workplaces this secretary was granted.
//
// Working days live per workplace, so a doctor who is at the clinic on Monday
// and the hospital on Tuesday has two schedules. A secretary granted only the
// clinic edits Monday and never sees Tuesday, because the hospital's row is
// not in the list the server returned.
//
// What is saved here is what the booking system reads, so opening a day makes
// slots bookable straight away. That is the point of the screen, and the
// reason it asks before saving.
// ---------------------------------------------------------------------------

export default function SecretarySchedule() {
  const {
    doctors, locations, activeDoctorId, activeDoctor,
    loading, error: ctxError, switchDoctor, reload, authHeader,
  } = useSecretary()

  const [placeId, setPlaceId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // The list the server returned is the source of truth; drafts only exist
  // while someone is mid-edit.
  const [draft, setDraft] = useState<Record<string, SecretaryLocation>>({})
  useEffect(() => {
    setDraft(Object.fromEntries(locations.map((l) => [l.doctor_location_id, l])))
  }, [locations])

  if (loading) return <Skeleton />
  if (ctxError) return <div className="icl p-6"><Message text={ctxError} tone="danger" /></div>
  if (doctors.length === 0) return <div className="icl p-6"><NoDoctors /></div>

  const shown = locations.filter((l) => !placeId || l.location_id === placeId)

  async function save(loc: SecretaryLocation) {
    const d = draft[loc.doctor_location_id]
    if (!d) return
    if (!confirm(
      `Save ${loc.name}'s working days?\n\nPatients can book the days you switch on as soon as this is saved.`,
    )) return

    setSaving(loc.doctor_location_id)
    setError('')
    try {
      const res = await fetch('/api/secretary/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          doctor_id: activeDoctorId,
          doctor_location_id: loc.doctor_location_id,
          working_days: d.working_days,
          working_hours: d.working_hours,
          appointment_duration: d.appointment_duration,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not save that')
      setToast(`${loc.name} updated`)
      setTimeout(() => setToast(''), 2600)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that')
    } finally { setSaving(null) }
  }

  function toggleDay(id: string, day: number) {
    setDraft((d) => {
      const cur = d[id]
      if (!cur) return d
      const on = cur.working_days.includes(day)
      const days = on ? cur.working_days.filter((x) => x !== day) : [...cur.working_days, day].sort()
      const hours = { ...cur.working_hours }
      // A day that is switched on needs hours, or it is open with nothing in it.
      if (!on && !hours[String(day)]) hours[String(day)] = { start: '09:00', end: '17:00' }
      return { ...d, [id]: { ...cur, working_days: days, working_hours: hours } }
    })
  }

  function setHours(id: string, day: number, which: 'start' | 'end', value: string) {
    setDraft((d) => {
      const cur = d[id]
      if (!cur) return d
      const hours = { ...cur.working_hours }
      const existing = hours[String(day)] ?? { start: '09:00', end: '17:00' }
      hours[String(day)] = { ...existing, [which]: value }
      return { ...d, [id]: { ...cur, working_hours: hours } }
    })
  }

  return (
    <div className="icl min-h-full" style={{ background: 'var(--icl-bg)' }}>
      <ContextBar
        doctors={doctors}
        activeDoctorId={activeDoctorId}
        onSwitchDoctor={(id) => { setPlaceId(null); switchDoctor(id) }}
        locations={locations}
        activeLocationId={placeId}
        onSwitchLocation={setPlaceId}
      />

      <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
        <h1 className="icl-hero">Schedule</h1>
        <p className="icl-sub mt-1">
          {activeDoctor ? `When ${activeDoctor.full_name} works, at the places you manage.` : ''}
        </p>

        {error ? <Message text={error} tone="danger" /> : null}

        {shown.length === 0 ? (
          <p className="icl-card icl-sub mt-5 px-5 py-10 text-center">
            No locations have been shared with you for this doctor yet.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {shown.map((loc) => {
              const d = draft[loc.doctor_location_id] ?? loc
              const dirty = JSON.stringify({ a: d.working_days, b: d.working_hours, c: d.appointment_duration })
                !== JSON.stringify({ a: loc.working_days, b: loc.working_hours, c: loc.appointment_duration })
              return (
                <div key={loc.doctor_location_id} className="icl-card p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" style={{ color: 'var(--icl-brand)' }} />
                    <h2 className="icl-h2">{loc.name}</h2>
                    {loc.city ? <span className="icl-small">· {loc.city}</span> : null}
                  </div>

                  {/* Days */}
                  <p className="icl-label mt-4 mb-2">Working days</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_SHORT.map((label, i) => {
                      const on = d.working_days.includes(i)
                      return (
                        <button
                          key={label}
                          onClick={() => toggleDay(loc.doctor_location_id, i)}
                          aria-pressed={on}
                          className="px-3 py-2 transition-colors"
                          style={{
                            fontSize: 13, fontWeight: 700,
                            borderRadius: 'var(--icl-r-md)',
                            background: on ? 'var(--icl-brand)' : 'var(--icl-card)',
                            color: on ? '#fff' : 'var(--icl-muted)',
                            border: on ? 'none' : '1.5px solid var(--icl-border)',
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Hours for each day that is on */}
                  {d.working_days.length > 0 ? (
                    <>
                      <p className="icl-label mt-4 mb-2">Hours</p>
                      <div className="space-y-2">
                        {d.working_days.map((day) => {
                          const h = d.working_hours[String(day)] ?? { start: '09:00', end: '17:00' }
                          return (
                            <div key={day} className="flex flex-wrap items-center gap-2">
                              <span className="icl-sub w-24">{DAY_NAMES[day]}</span>
                              <input
                                type="time" className="icl-input w-auto py-2" value={h.start}
                                onChange={(e) => setHours(loc.doctor_location_id, day, 'start', e.target.value)}
                              />
                              <span className="icl-small">to</span>
                              <input
                                type="time" className="icl-input w-auto py-2" value={h.end}
                                onChange={(e) => setHours(loc.doctor_location_id, day, 'end', e.target.value)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="icl-sub mt-3">Not working here. Switch a day on to open bookings.</p>
                  )}

                  {dirty ? (
                    <button
                      onClick={() => save(loc)}
                      disabled={saving === loc.doctor_location_id}
                      className="icl-btn icl-btn-primary mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                    >
                      {saving === loc.doctor_location_id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Check className="h-4 w-4" />}
                      Save {loc.name}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast ? (
        <div
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5"
          style={{ background: 'var(--icl-ink)', color: '#fff', borderRadius: 'var(--icl-r-full)', fontSize: 14, fontWeight: 600 }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  )
}
