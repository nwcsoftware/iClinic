'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserCog, Plus, MapPin, Loader2, X, Check, AlertTriangle, Building2, Trash2, Power,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Secretary management, for a doctor.
//
// The screen exists to make one thing obvious: a secretary sees the workplaces
// you name and nothing else. So every card leads with its locations, and the
// add form will not let you finish without choosing at least one — a secretary
// with no locations can do nothing, which is a confusing way to start.
//
// Styled from the iClinic tokens rather than the dashboard's slate palette, so
// it belongs to the same product as the patient app.
// ---------------------------------------------------------------------------

type Workplace = { id: string; name: string; city: string | null; type: string }

type Secretary = {
  id: string
  receptionist_id: string
  full_name: string
  phone: string | null
  status: 'active' | 'inactive'
  created_at: string
  locations: { doctor_location_id: string; name: string; city: string | null; type: string }[]
}

const MAX = 3

export default function SecretariesPage() {
  const supabase = createClient()
  const [secretaries, setSecretaries] = useState<Secretary[]>([])
  const [workplaces, setWorkplaces] = useState<Workplace[]>([])
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Secretary | null>(null)

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }, [supabase])

  const load = useCallback(async () => {
    try {
      const headers = await authHeader()
      const [sRes, wRes] = await Promise.all([
        fetch('/api/doctor/secretaries', { headers }),
        fetch('/api/doctor/locations', { headers }),
      ])
      const sBody = await sRes.json()
      const wBody = await wRes.json()
      if (!sRes.ok) throw new Error(sBody.error ?? 'Could not load your secretaries')
      setSecretaries(sBody.secretaries ?? [])
      setEnabled(sBody.enabled !== false)
      setWorkplaces(
        (wBody.locations ?? [])
          .filter((l: { location: unknown }) => l.location)
          .map((l: { id: string; location: { name: string; city: string | null; type: string } }) => ({
            id: l.id, name: l.location.name, city: l.location.city, type: l.location.type,
          })),
      )
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [authHeader])

  useEffect(() => { load() }, [load])

  async function send(method: string, body?: unknown, query = '') {
    const headers = { 'Content-Type': 'application/json', ...(await authHeader()) }
    const res = await fetch(`/api/doctor/secretaries${query}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    })
    const out = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(out.error ?? 'That did not work')
    return out
  }

  const used = secretaries.length
  const full = used >= MAX

  if (loading) return <Skeleton />

  return (
    <div className="icl min-h-full" style={{ background: 'var(--icl-bg)' }}>
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="icl-hero">Secretaries</h1>
            <p className="icl-sub mt-1 max-w-lg">
              People who manage your diary. They see the workplaces you give them, and never a
              diagnosis, a prescription or a reason for a visit.
            </p>
          </div>

          <button
            className="icl-btn icl-btn-primary inline-flex items-center gap-2 disabled:opacity-55"
            onClick={() => { setAdding(true); setNotice('') }}
            disabled={full || !enabled}
            title={full ? `You already have ${MAX}` : undefined}
          >
            <Plus className="h-4 w-4" /> Add secretary
          </button>
        </header>

        {/* Slots. Shown always, so the limit is never a surprise at the moment
            of pressing Add. */}
        <div className="mt-5 flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX }).map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-10 rounded-full"
                style={{ background: i < used ? 'var(--icl-accent)' : 'var(--icl-border-strong)' }}
              />
            ))}
          </div>
          <span className="icl-small">{used} of {MAX} secretary accounts used</span>
        </div>

        {!enabled ? (
          <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
            Secretary accounts are not switched on for this database yet.
          </Banner>
        ) : null}
        {error ? <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>{error}</Banner> : null}
        {notice ? <Banner tone="success" icon={<Check className="h-4 w-4" />}>{notice}</Banner> : null}

        {full ? (
          <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
            You have reached the maximum of {MAX} secretaries. Remove one to add another.
          </Banner>
        ) : null}

        {/* List */}
        <div className="mt-6 space-y-3">
          {secretaries.length === 0 ? (
            <EmptyState onAdd={() => setAdding(true)} disabled={!enabled} />
          ) : (
            secretaries.map((s) => (
              <SecretaryCard
                key={s.id}
                secretary={s}
                onEdit={() => setEditing(s)}
                onToggle={async () => {
                  try {
                    await send('PATCH', { id: s.id, status: s.status === 'active' ? 'inactive' : 'active' })
                    setNotice(`${s.full_name} is now ${s.status === 'active' ? 'inactive' : 'active'}.`)
                    load()
                  } catch (e) { setError(e instanceof Error ? e.message : 'Could not change that') }
                }}
                onRemove={async () => {
                  if (!confirm(
                    `Remove ${s.full_name} from your practice?\n\nThey lose access to your schedule and appointments immediately. Their account stays, along with any other doctor they work for.`,
                  )) return
                  try {
                    const out = await send('DELETE', undefined, `?id=${s.id}`)
                    setNotice(
                      out.still_works_for_others
                        ? `${s.full_name} was removed from your practice. Their account remains, as they work for another doctor.`
                        : `${s.full_name} was removed from your practice.`,
                    )
                    load()
                  } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove them') }
                }}
              />
            ))
          )}
        </div>
      </div>

      {adding ? (
        <AddSecretary
          workplaces={workplaces}
          onClose={() => setAdding(false)}
          onCreated={(name) => { setAdding(false); setNotice(`${name} can now sign in.`); load() }}
          send={send}
        />
      ) : null}

      {editing ? (
        <EditLocations
          secretary={editing}
          workplaces={workplaces}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setNotice('Locations updated.'); load() }}
          send={send}
        />
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function SecretaryCard({
  secretary, onEdit, onToggle, onRemove,
}: {
  secretary: Secretary
  onEdit: () => void
  onToggle: () => void
  onRemove: () => void
}) {
  const off = secretary.status !== 'active'
  return (
    <div className="icl-card p-4 sm:p-5" style={{ opacity: off ? 0.72 : 1 }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--icl-accent-soft)' }}
          >
            <UserCog className="h-5 w-5" style={{ color: 'var(--icl-accent)' }} />
          </div>
          <div>
            <h2 className="icl-h2">{secretary.full_name}</h2>
            <p className="icl-small mt-0.5">
              {secretary.phone ?? 'No phone'} ·{' '}
              <span style={{ color: off ? 'var(--icl-amber)' : 'var(--icl-success)', fontWeight: 700 }}>
                {off ? 'Inactive' : 'Active'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <SmallButton onClick={onEdit} icon={<MapPin className="h-3.5 w-3.5" />}>Edit locations</SmallButton>
          <SmallButton onClick={onToggle} icon={<Power className="h-3.5 w-3.5" />}>
            {off ? 'Activate' : 'Deactivate'}
          </SmallButton>
          <SmallButton onClick={onRemove} danger icon={<Trash2 className="h-3.5 w-3.5" />}>Remove</SmallButton>
        </div>
      </div>

      {/* Locations lead, because they are the permission. */}
      <div className="mt-4">
        <p className="icl-label mb-2">Can manage</p>
        {secretary.locations.length === 0 ? (
          <p className="icl-sub" style={{ color: 'var(--icl-amber)' }}>
            No locations yet, so they cannot see anything. Add one with Edit locations.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {secretary.locations.map((l) => (
              <span
                key={l.doctor_location_id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5"
                style={{
                  background: 'var(--icl-accent-softer)',
                  color: 'var(--icl-accent-dark)',
                  borderRadius: 'var(--icl-r-full)',
                  fontSize: 13, fontWeight: 700,
                }}
              >
                <Building2 className="h-3.5 w-3.5" />
                {l.name}{l.city ? ` · ${l.city}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AddSecretary({
  workplaces, onClose, onCreated, send,
}: {
  workplaces: Workplace[]
  onClose: () => void
  onCreated: (name: string) => void
  send: (m: string, b?: unknown, q?: string) => Promise<{ [k: string]: unknown }>
}) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (picked.length === 0) {
      setError('Choose at least one location. A secretary with none cannot see anything.')
      return
    }
    setBusy(true)
    try {
      await send('POST', { ...form, doctor_location_ids: picked })
      onCreated(form.full_name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create that account')
    } finally { setBusy(false) }
  }

  return (
    <Sheet title="Add a secretary" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name">
          <input className="icl-input" required value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Rana Khalil" />
        </Field>
        <Field label="Email">
          <input className="icl-input" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="They sign in with this" />
        </Field>
        <Field label="Phone" hint="Optional">
          <input className="icl-input" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+961 …" />
        </Field>
        <Field label="Starting password" hint="They can change it after signing in">
          <input className="icl-input" type="text" required minLength={8} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
        </Field>

        <div>
          <p className="icl-label mb-2">Which of your workplaces?</p>
          <LocationPicker workplaces={workplaces} picked={picked} setPicked={setPicked} />
        </div>

        {error ? <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>{error}</Banner> : null}

        <button type="submit" className="icl-btn icl-btn-primary w-full inline-flex items-center justify-center gap-2" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Create account
        </button>
      </form>
    </Sheet>
  )
}

function EditLocations({
  secretary, workplaces, onClose, onSaved, send,
}: {
  secretary: Secretary
  workplaces: Workplace[]
  onClose: () => void
  onSaved: () => void
  send: (m: string, b?: unknown, q?: string) => Promise<{ [k: string]: unknown }>
}) {
  const [picked, setPicked] = useState<string[]>(secretary.locations.map((l) => l.doctor_location_id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setBusy(true); setError('')
    try {
      await send('PATCH', { id: secretary.id, doctor_location_ids: picked })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that')
    } finally { setBusy(false) }
  }

  const removing = secretary.locations.filter((l) => !picked.includes(l.doctor_location_id))

  return (
    <Sheet title={`${secretary.full_name}'s locations`} onClose={onClose}>
      <LocationPicker workplaces={workplaces} picked={picked} setPicked={setPicked} />

      {removing.length > 0 ? (
        <Banner tone="amber" icon={<AlertTriangle className="h-4 w-4" />}>
          They lose access to {removing.map((l) => l.name).join(', ')} as soon as you save.
        </Banner>
      ) : null}
      {error ? <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>{error}</Banner> : null}

      <button onClick={save} className="icl-btn icl-btn-primary mt-4 w-full inline-flex items-center justify-center gap-2" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save locations
      </button>
    </Sheet>
  )
}

function LocationPicker({
  workplaces, picked, setPicked,
}: {
  workplaces: Workplace[]
  picked: string[]
  setPicked: (v: string[]) => void
}) {
  if (workplaces.length === 0) {
    return (
      <p className="icl-sub" style={{ color: 'var(--icl-amber)' }}>
        You have no workplaces yet. Add one from the app first, then you can share it.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {workplaces.map((w) => {
        const on = picked.includes(w.id)
        return (
          <button
            key={w.id}
            type="button"
            onClick={() => setPicked(on ? picked.filter((x) => x !== w.id) : [...picked, w.id])}
            className="flex w-full items-center gap-3 p-3 text-left transition-colors"
            style={{
              border: `1.5px solid ${on ? 'var(--icl-accent)' : 'var(--icl-border)'}`,
              background: on ? 'var(--icl-accent-softer)' : 'var(--icl-card)',
              borderRadius: 'var(--icl-r-md)',
            }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{
                background: on ? 'var(--icl-accent)' : 'transparent',
                border: on ? 'none' : '1.5px solid var(--icl-border-strong)',
              }}
            >
              {on ? <Check className="h-3.5 w-3.5 text-white" /> : null}
            </span>
            <span>
              <span className="block" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--icl-ink)' }}>{w.name}</span>
              <span className="icl-small">{w.city ?? 'Location'}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/* ---- small shared pieces -------------------------------------------------- */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(9,16,33,0.45)' }}>
      <div
        className="icl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6"
        style={{ background: 'var(--icl-card)', borderRadius: 'var(--icl-r-xl)', boxShadow: 'var(--icl-shadow-raised)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="icl-h1">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1"><X className="h-5 w-5" style={{ color: 'var(--icl-faint)' }} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="icl-label mb-1.5 block">{label}{hint ? <span className="icl-small font-normal"> · {hint}</span> : null}</span>
      {children}
    </label>
  )
}

function SmallButton({
  children, onClick, icon, danger,
}: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors"
      style={{
        border: '1.5px solid var(--icl-border)',
        borderRadius: 'var(--icl-r-full)',
        fontSize: 13, fontWeight: 700,
        color: danger ? 'var(--icl-danger)' : 'var(--icl-text)',
        background: 'var(--icl-card)',
      }}
    >
      {icon}{children}
    </button>
  )
}

function Banner({ tone, icon, children }: { tone: 'danger' | 'amber' | 'success'; icon: React.ReactNode; children: React.ReactNode }) {
  const bg = tone === 'danger' ? 'var(--icl-danger-bg)' : tone === 'amber' ? 'var(--icl-amber-bg)' : 'var(--icl-success-bg)'
  const fg = tone === 'danger' ? 'var(--icl-danger)' : tone === 'amber' ? 'var(--icl-amber)' : 'var(--icl-success)'
  return (
    <div className="mt-4 flex items-start gap-2.5 p-3" style={{ background: bg, borderRadius: 'var(--icl-r-md)' }}>
      <span style={{ color: fg }} className="mt-0.5">{icon}</span>
      <span className="icl-sub" style={{ color: fg }}>{children}</span>
    </div>
  )
}

function EmptyState({ onAdd, disabled }: { onAdd: () => void; disabled: boolean }) {
  return (
    <div className="icl-card flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--icl-accent-soft)' }}>
        <UserCog className="h-6 w-6" style={{ color: 'var(--icl-accent)' }} />
      </div>
      <h2 className="icl-h2 mt-4">No secretaries yet</h2>
      <p className="icl-sub mt-2 max-w-sm">
        Add someone to manage your diary. You choose which of your workplaces they can see, and
        they never get near a diagnosis or a prescription.
      </p>
      <button onClick={onAdd} disabled={disabled} className="icl-btn icl-btn-primary mt-5 inline-flex items-center gap-2">
        <Plus className="h-4 w-4" /> Add secretary
      </button>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="icl min-h-full" style={{ background: 'var(--icl-bg)' }}>
      <div className="mx-auto max-w-4xl space-y-3 px-5 py-8 sm:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg" style={{ background: 'var(--icl-border)' }} />
        <div className="h-4 w-80 animate-pulse rounded" style={{ background: 'var(--icl-border)' }} />
        {[0, 1].map((i) => (
          <div key={i} className="h-28 animate-pulse" style={{ background: 'var(--icl-border)', borderRadius: 'var(--icl-r-lg)' }} />
        ))}
      </div>
    </div>
  )
}
