'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock, Building2, Phone, Droplet, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useSecretary, STATUS_LABEL, STATUS_TONE, DAY_SHORT } from '@/hooks/useSecretary'
import ContextBar from './ContextBar'
import { Skeleton, Message, NoDoctors } from './Appointments'

// ---------------------------------------------------------------------------
// The secretary's first screen.
//
// Answers the two questions someone actually opens this for: who is coming
// today, and what is coming next. Everything else is a link away.
//
// Same view as the appointment list underneath, so the same medical fields are
// absent here for the same structural reason.
// ---------------------------------------------------------------------------

type Row = {
  id: string
  appointment_date: string
  start_time: string
  status: string
  location_id: string
  patient_name: string
  patient_phone: string | null
  patient_blood_type: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

export default function SecretaryOverview() {
  const {
    doctors, locations, activeDoctorId, activeDoctor,
    loading: ctxLoading, error: ctxError, switchDoctor, authHeader,
  } = useSecretary()

  const [placeId, setPlaceId] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeDoctorId) { setRows([]); setLoading(false); return }
    setLoading(true)
    try {
      // Today onwards. The past is on the appointments screen, with filters.
      const p = new URLSearchParams({ doctor_id: activeDoctorId, from: today() })
      if (placeId) p.set('location_id', placeId)
      const res = await fetch(`/api/secretary/appointments?${p}`, { headers: await authHeader() })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load the diary')
      setRows(body.appointments ?? [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [activeDoctorId, placeId, authHeader])

  useEffect(() => { load() }, [load])

  if (ctxLoading) return <Skeleton />
  if (ctxError) return <div className="icl p-6"><Message text={ctxError} tone="danger" /></div>
  if (doctors.length === 0) return <div className="icl p-6"><NoDoctors /></div>

  const now = today()
  const todays = rows.filter((r) => r.appointment_date === now)
  const upcoming = rows.filter((r) => r.appointment_date > now).slice(0, 6)

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

      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <h1 className="icl-hero">
          {greeting()}
        </h1>
        <p className="icl-sub mt-1">
          {activeDoctor ? `Managing ${activeDoctor.full_name}'s diary` : 'No doctor selected'}
          {locations.length > 0 ? ` · ${placeId ? locations.find((l) => l.location_id === placeId)?.name : `${locations.length} location${locations.length === 1 ? '' : 's'}`}` : ''}
        </p>

        {error ? <Message text={error} tone="danger" /> : null}

        {/* Counts */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Today" value={todays.length} icon={<CalendarDays className="h-4 w-4" />} />
          <Stat label="Still to confirm" value={todays.filter((r) => r.status === 'scheduled').length} icon={<Clock className="h-4 w-4" />} />
          <Stat label="Locations you manage" value={locations.length} icon={<Building2 className="h-4 w-4" />} />
        </div>

        {/* Today */}
        <section className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="icl-h1">Today</h2>
            <Link href="/appointments" className="icl-sub inline-flex items-center gap-1" style={{ color: 'var(--icl-brand)', fontWeight: 700 }}>
              All appointments <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse" style={{ background: 'var(--icl-border)', borderRadius: 'var(--icl-r-lg)' }} />)}
            </div>
          ) : todays.length === 0 ? (
            <p className="icl-card icl-sub mt-3 px-5 py-8 text-center">
              Nothing booked today at {placeId ? 'this location' : 'the locations you manage'}.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {todays.map((r) => <AppointmentRow key={r.id} row={r} locations={locations} />)}
            </div>
          )}
        </section>

        {/* Next few */}
        {upcoming.length > 0 ? (
          <section className="mt-7">
            <h2 className="icl-h1">Coming up</h2>
            <div className="mt-3 space-y-2">
              {upcoming.map((r) => <AppointmentRow key={r.id} row={r} locations={locations} showDate />)}
            </div>
          </section>
        ) : null}

        {/* Working days, so the secretary knows when the doctor is even in */}
        {locations.length > 0 ? (
          <section className="mt-7">
            <h2 className="icl-h1">Working days</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {locations.map((l) => (
                <div key={l.doctor_location_id} className="icl-card p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" style={{ color: 'var(--icl-brand)' }} />
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--icl-ink)' }}>{l.name}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {DAY_SHORT.map((d, i) => {
                      const on = l.working_days.includes(i)
                      return (
                        <span
                          key={d}
                          className="px-2 py-1"
                          style={{
                            fontSize: 11.5, fontWeight: 700,
                            borderRadius: 'var(--icl-r-sm)',
                            background: on ? 'var(--icl-brand-soft)' : 'transparent',
                            color: on ? 'var(--icl-brand-dark)' : 'var(--icl-faint)',
                            border: on ? 'none' : '1px solid var(--icl-border)',
                          }}
                        >
                          {d}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function AppointmentRow({
  row, locations, showDate,
}: {
  row: Row
  locations: { location_id: string; name: string }[]
  showDate?: boolean
}) {
  const tone = STATUS_TONE[row.status] ?? { bg: '#EEF1F6', fg: 'var(--icl-muted)' }
  return (
    <div className="icl-card flex flex-wrap items-center gap-3 p-3.5">
      <div
        className="flex h-11 w-14 shrink-0 flex-col items-center justify-center"
        style={{ background: 'var(--icl-brand-softer)', borderRadius: 'var(--icl-r-md)' }}
      >
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--icl-brand-dark)' }}>{row.start_time.slice(0, 5)}</span>
        {showDate ? (
          <span className="icl-small" style={{ fontSize: 10 }}>
            {new Date(`${row.appointment_date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--icl-ink)' }}>{row.patient_name}</div>
        <div className="icl-small flex flex-wrap items-center gap-x-3">
          {row.patient_phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{row.patient_phone}</span> : null}
          {row.patient_blood_type ? <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" />{row.patient_blood_type}</span> : null}
          <span>{locations.find((l) => l.location_id === row.location_id)?.name ?? 'Location'}</span>
        </div>
      </div>

      <span
        className="px-2.5 py-1"
        style={{ background: tone.bg, color: tone.fg, borderRadius: 'var(--icl-r-full)', fontSize: 12, fontWeight: 800 }}
      >
        {STATUS_LABEL[row.status] ?? row.status}
      </span>
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="icl-card p-4">
      <div className="flex items-center gap-2 icl-label">{icon}{label}</div>
      <div className="mt-1" style={{ fontSize: 28, fontWeight: 800, color: 'var(--icl-ink)', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
