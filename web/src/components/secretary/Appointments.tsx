'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Search, Loader2, CalendarDays, Phone, Droplet, Check, X, Clock, Building2,
} from 'lucide-react'
import {
  useSecretary, STATUS_LABEL, STATUS_TONE, type SecretaryLocation,
} from '@/hooks/useSecretary'
import ContextBar from './ContextBar'

// ---------------------------------------------------------------------------
// The secretary's appointment list.
//
// Everything shown here comes from secretary_appointments, a view with no
// reason, no notes, no diagnosis and no prescription in it. There is no
// medical field being hidden by this component, because none arrives.
//
// The only edit is the status, and only the administrative ones: whether the
// patient is coming, came, or did not. Saying someone attended is a fact about
// attendance, not about their health.
// ---------------------------------------------------------------------------

type Appointment = {
  id: string
  doctor_id: string
  location_id: string
  appointment_date: string
  start_time: string
  status: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  patient_blood_type: string | null
}

const SETTABLE = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const

export default function SecretaryAppointments() {
  const {
    doctors, locations, activeDoctorId, loading: ctxLoading, error: ctxError,
    switchDoctor, authHeader,
  } = useSecretary()

  const [placeId, setPlaceId] = useState<string | null>(null)
  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const [date, setDate] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    if (!activeDoctorId) { setRows([]); setLoading(false); return }
    setLoading(true)
    try {
      const p = new URLSearchParams({ doctor_id: activeDoctorId })
      if (placeId) p.set('location_id', placeId)
      if (date) p.set('date', date)
      if (status) p.set('status', status)
      if (query.trim()) p.set('q', query.trim())

      const res = await fetch(`/api/secretary/appointments?${p}`, { headers: await authHeader() })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load appointments')
      setRows(body.appointments ?? [])
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setLoading(false) }
  }, [activeDoctorId, placeId, date, status, query, authHeader])

  useEffect(() => { load() }, [load])

  // Switching doctor clears the location, because a location belongs to one
  // doctor and carrying it across would ask for something not granted.
  function pickDoctor(id: string) { setPlaceId(null); switchDoctor(id) }

  async function setStatusOf(a: Appointment, next: string) {
    setSaving(a.id)
    try {
      const res = await fetch('/api/secretary/appointments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ id: a.id, status: next }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not update that')
      setRows((list) => list.map((r) => (r.id === a.id ? { ...r, status: next } : r)))
      setToast(`${a.patient_name} — ${STATUS_LABEL[next] ?? next}`)
      setTimeout(() => setToast(''), 2600)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that')
    } finally { setSaving(null) }
  }

  if (ctxLoading) return <Skeleton />
  if (ctxError) return <Message text={ctxError} tone="danger" />
  if (doctors.length === 0) return <NoDoctors />

  return (
    <div className="icl min-h-full" style={{ background: 'var(--icl-bg)' }}>
      <ContextBar
        doctors={doctors}
        activeDoctorId={activeDoctorId}
        onSwitchDoctor={pickDoctor}
        locations={locations}
        activeLocationId={placeId}
        onSwitchLocation={setPlaceId}
      />

      <div className="mx-auto max-w-5xl px-5 py-6 sm:px-8">
        <h1 className="icl-hero">Appointments</h1>

        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--icl-faint)' }} />
            <input
              className="icl-input pl-9"
              placeholder="Search by patient name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <input type="date" className="icl-input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="icl-input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            {SETTABLE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {(date || status || query) ? (
            <button
              className="icl-btn icl-btn-ghost px-4 py-2 text-sm"
              onClick={() => { setDate(''); setStatus(''); setQuery('') }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {error ? <Message text={error} tone="danger" /> : null}

        {loading ? (
          <div className="mt-5 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse" style={{ background: 'var(--icl-border)', borderRadius: 'var(--icl-r-lg)' }} />
            ))}
          </div>
        ) : locations.length === 0 ? (
          <NoLocations />
        ) : rows.length === 0 ? (
          <Empty filtered={!!(date || status || query)} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="icl-card mt-5 hidden overflow-hidden md:block">
              <table className="w-full text-left">
                <thead>
                  <tr style={{ background: 'var(--icl-accent-softer)' }}>
                    {['Patient', 'When', 'Where', 'Status', ''].map((h) => (
                      <th key={h} className="icl-label px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--icl-border)' }}>
                      <td className="px-4 py-3">
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--icl-ink)' }}>{a.patient_name}</div>
                        <div className="icl-small flex items-center gap-2">
                          {a.patient_phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{a.patient_phone}</span> : null}
                          {a.patient_blood_type ? <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" />{a.patient_blood_type}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 icl-sub">{humanDate(a.appointment_date)}<br />{a.start_time.slice(0, 5)}</td>
                      <td className="px-4 py-3 icl-sub">{placeName(locations, a.location_id)}</td>
                      <td className="px-4 py-3"><StatusPill status={a.status} /></td>
                      <td className="px-4 py-3">
                        <StatusMenu appointment={a} busy={saving === a.id} onPick={setStatusOf} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cards on small screens: a five-column table on a phone is a
                horizontal scroll nobody wins. */}
            <div className="mt-5 space-y-2 md:hidden">
              {rows.map((a) => (
                <div key={a.id} className="icl-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--icl-ink)' }}>{a.patient_name}</div>
                      <div className="icl-small mt-0.5 flex flex-wrap items-center gap-x-3">
                        {a.patient_phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{a.patient_phone}</span> : null}
                        {a.patient_blood_type ? <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" />{a.patient_blood_type}</span> : null}
                      </div>
                    </div>
                    <StatusPill status={a.status} />
                  </div>
                  <div className="icl-sub mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{humanDate(a.appointment_date)}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{a.start_time.slice(0, 5)}</span>
                    <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{placeName(locations, a.location_id)}</span>
                  </div>
                  <div className="mt-3">
                    <StatusMenu appointment={a} busy={saving === a.id} onPick={setStatusOf} wide />
                  </div>
                </div>
              ))}
            </div>
          </>
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

/* -------------------------------------------------------------------------- */

function StatusMenu({
  appointment, busy, onPick, wide,
}: {
  appointment: { id: string; status: string; patient_name: string }
  busy: boolean
  onPick: (a: never, s: string) => void
  wide?: boolean
}) {
  // Confirming attendance is routine and reversible; cancelling is neither, so
  // it asks first.
  function choose(next: string) {
    if (next === appointment.status) return
    if (next === 'cancelled' && !confirm(`Cancel ${appointment.patient_name}'s appointment?`)) return
    onPick(appointment as never, next)
  }
  return (
    <div className={wide ? 'grid grid-cols-2 gap-1.5' : 'flex flex-wrap gap-1.5'}>
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--icl-accent)' }} />
      ) : (
        (['confirmed', 'completed', 'no_show', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => choose(s)}
            disabled={s === appointment.status}
            className="px-2.5 py-1.5 transition-colors disabled:opacity-40"
            style={{
              border: '1.5px solid var(--icl-border)',
              borderRadius: 'var(--icl-r-full)',
              fontSize: 12.5, fontWeight: 700,
              color: STATUS_TONE[s]?.fg ?? 'var(--icl-text)',
              background: s === appointment.status ? (STATUS_TONE[s]?.bg ?? 'transparent') : 'var(--icl-card)',
            }}
          >
            {s === 'completed' ? <Check className="mr-1 inline h-3 w-3" /> : null}
            {s === 'no_show' ? <X className="mr-1 inline h-3 w-3" /> : null}
            {STATUS_LABEL[s]}
          </button>
        ))
      )}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? { bg: '#EEF1F6', fg: 'var(--icl-muted)' }
  return (
    <span
      className="inline-block px-2.5 py-1"
      style={{ background: tone.bg, color: tone.fg, borderRadius: 'var(--icl-r-full)', fontSize: 12.5, fontWeight: 800 }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function placeName(locations: SecretaryLocation[], id: string) {
  return locations.find((l) => l.location_id === id)?.name ?? 'Location'
}

function humanDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function Skeleton() {
  return (
    <div className="icl min-h-full" style={{ background: 'var(--icl-bg)' }}>
      <div className="mx-auto max-w-5xl space-y-3 px-5 py-8 sm:px-8">
        <div className="h-8 w-52 animate-pulse rounded-lg" style={{ background: 'var(--icl-border)' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse" style={{ background: 'var(--icl-border)', borderRadius: 'var(--icl-r-lg)' }} />
        ))}
      </div>
    </div>
  )
}

export function Message({ text, tone }: { text: string; tone: 'danger' | 'amber' }) {
  const bg = tone === 'danger' ? 'var(--icl-danger-bg)' : 'var(--icl-amber-bg)'
  const fg = tone === 'danger' ? 'var(--icl-danger)' : 'var(--icl-amber)'
  return (
    <div className="icl mt-4 p-3" style={{ background: bg, borderRadius: 'var(--icl-r-md)' }}>
      <span className="icl-sub" style={{ color: fg }}>{text}</span>
    </div>
  )
}

export function NoDoctors() {
  return (
    <Centered
      title="No doctor has added you yet"
      body="When a doctor adds you to their practice and chooses which of their locations you manage, their schedule appears here."
    />
  )
}

function NoLocations() {
  return (
    <Centered
      title="No locations yet"
      body="This doctor has not chosen which of their workplaces you manage. Ask them to add one and it will appear here."
    />
  )
}

function Empty({ filtered }: { filtered: boolean }) {
  return (
    <Centered
      title={filtered ? 'Nothing matches that' : 'No appointments'}
      body={filtered
        ? 'Try a different date or clear the filters.'
        : 'Appointments for the locations you manage will show up here as patients book them.'}
    />
  )
}

function Centered({ title, body }: { title: string; body: string }) {
  return (
    <div className="icl-card mt-5 flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--icl-accent-soft)' }}>
        <CalendarDays className="h-6 w-6" style={{ color: 'var(--icl-accent)' }} />
      </div>
      <h2 className="icl-h2 mt-4">{title}</h2>
      <p className="icl-sub mt-2 max-w-sm">{body}</p>
    </div>
  )
}
