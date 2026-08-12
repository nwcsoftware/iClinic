'use client'

import { useCallback, useEffect, useState } from 'react'

// Admin billing console. Everything here goes through /api/admin/subscription,
// which is guarded by ADMIN_API_KEY — this page just holds the key for the tab
// and renders the queue. Nothing is readable without it.

type Doctor = {
  doctor_id: string; full_name: string; specialty: string | null
  status: string; days_left: number; current_period_end: string | null
  visible_to_patients: boolean; provider: string | null
}
type Claim = {
  id: string; doctor_id: string; doctor_name: string; amount_usd: number
  method: string; reference: string | null; months: number | null
  note: string | null; created_at: string
}
type Summary = {
  total: number; visible: number; expiring_7d: number; lapsed: number; pending_claims: number
}

const KEY_STORE = 'iclinic.adminKey'

// sessionStorage clears when the tab closes, which is right on a shared
// machine but means re-typing the key every time an alert lands on your phone.
// "Remember on this device" opts into localStorage instead — off by default.
function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? sessionStorage.getItem(KEY_STORE) ?? ''
  } catch { return '' }
}
function writeKey(k: string, remember: boolean) {
  try {
    if (remember) localStorage.setItem(KEY_STORE, k)
    else sessionStorage.setItem(KEY_STORE, k)
  } catch { /* private mode */ }
}
function clearKey() {
  try { localStorage.removeItem(KEY_STORE); sessionStorage.removeItem(KEY_STORE) } catch { /* no-op */ }
}

export default function AdminBillingPage() {
  const [key, setKey] = useState('')
  const [entered, setEntered] = useState('')
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [remember, setRemember] = useState(false)

  useEffect(() => {
    const saved = readKey()
    if (saved) setKey(saved)
  }, [])

  const load = useCallback(async (k: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/subscription', { headers: { Authorization: `Bearer ${k}` } })
      if (res.status === 401) throw new Error('That key was not accepted.')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Could not load')
      setDoctors(body.doctors ?? [])
      setClaims(body.claims ?? [])
      setSummary(body.summary ?? null)
      writeKey(k, remember)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load')
      setKey('')
      clearKey()
    } finally {
      setLoading(false)
    }
  }, [remember])

  useEffect(() => { if (key) load(key) }, [key, load])

  async function post(payload: Record<string, unknown>, id: string) {
    setBusy(id)
    setError('')
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Failed')
      await load(key)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  // ---- Key gate -----------------------------------------------------------
  if (!key) {
    return (
      <main style={S.center}>
        <div style={S.card}>
          <h1 style={S.h1}>Billing admin</h1>
          <p style={S.sub}>Enter your admin key. It is kept for this tab only.</p>
          <input
            style={S.input}
            type="password"
            placeholder="ADMIN_API_KEY"
            value={entered}
            onChange={(e) => setEntered(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && entered.trim()) setKey(entered.trim()) }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '2px 0 14px', fontSize: 13.5, color: '#5B6577' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember on this device
          </label>
          <button style={S.btn} onClick={() => entered.trim() && setKey(entered.trim())}>Open</button>
          {error ? <p style={S.err}>{error}</p> : null}
        </div>
      </main>
    )
  }

  return (
    <main style={S.page}>
      <div style={S.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h1 style={{ ...S.h1, flex: 1, margin: 0 }}>Billing</h1>
          <button style={S.ghost} onClick={() => load(key)} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button style={S.ghost} onClick={() => { clearKey(); setKey(''); setEntered('') }}>
            Lock
          </button>
        </div>

        {error ? <p style={S.err}>{error}</p> : null}

        {summary ? (
          <div style={S.stats}>
            <Stat label="Doctors" value={summary.total} />
            <Stat label="Visible to patients" value={summary.visible} tone="#0E7E58" />
            <Stat label="Expiring in 7 days" value={summary.expiring_7d} tone="#B45309" />
            <Stat label="Lapsed" value={summary.lapsed} tone="#B91C1C" />
            <Stat label="Awaiting approval" value={summary.pending_claims} tone="#2748B8" />
          </div>
        ) : null}

        {/* Payments doctors say they have made */}
        <h2 style={S.h2}>Reported payments{claims.length ? ` (${claims.length})` : ''}</h2>
        {claims.length === 0 ? (
          <p style={S.sub}>Nothing waiting. Doctors who pay by Whish or OMT appear here.</p>
        ) : (
          claims.map((c) => (
            <div key={c.id} style={S.row}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={S.name}>{c.doctor_name}</div>
                <div style={S.meta}>
                  ${Number(c.amount_usd).toFixed(2)} · {c.method.replace('_', ' ')} · {c.months ?? 1} month
                  {(c.months ?? 1) === 1 ? '' : 's'}
                  {c.reference ? ` · ref ${c.reference}` : ''}
                </div>
                {c.note ? <div style={S.note}>{c.note}</div> : null}
                <div style={S.meta}>{new Date(c.created_at).toLocaleString()}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.approve} disabled={busy === c.id}
                  onClick={() => post({ claim_id: c.id }, c.id)}>
                  {busy === c.id ? '…' : 'Approve'}
                </button>
                <button style={S.reject} disabled={busy === c.id}
                  onClick={() => post({ claim_id: c.id, reject: true }, c.id)}>
                  Reject
                </button>
              </div>
            </div>
          ))
        )}

        {/* Everyone, so you can extend anyone by hand */}
        <h2 style={S.h2}>Doctors</h2>
        {doctors.map((d) => {
          const tone = !d.visible_to_patients ? '#B91C1C' : d.days_left <= 7 ? '#B45309' : '#0E7E58'
          return (
            <div key={d.doctor_id} style={S.row}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={S.name}>{d.full_name}</div>
                <div style={S.meta}>
                  <span style={{ color: tone, fontWeight: 700 }}>
                    {d.visible_to_patients ? `${d.days_left} days left` : 'Not visible to patients'}
                  </span>
                  {' · '}{d.status}{d.specialty ? ` · ${d.specialty}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 3, 12].map((m) => (
                  <button key={m} style={S.small} disabled={busy === d.doctor_id + m}
                    onClick={() => post({ doctor_id: d.doctor_id, months: m, method: 'manual' }, d.doctor_id + m)}>
                    {busy === d.doctor_id + m ? '…' : `+${m}m`}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div style={S.stat}>
      <div style={{ fontSize: 24, fontWeight: 800, color: tone ?? '#0D1526' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#5B6577', fontWeight: 600 }}>{label}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F6FA', padding: 24 },
  page: { minHeight: '100vh', background: '#F5F6FA', padding: '28px 16px' },
  wrap: { maxWidth: 860, margin: '0 auto' },
  card: { width: '100%', maxWidth: 380, background: '#fff', borderRadius: 18, padding: 26, boxShadow: '0 10px 40px rgba(16,28,61,0.10)' },
  h1: { fontSize: 24, fontWeight: 800, color: '#0D1526', margin: '0 0 6px' },
  h2: { fontSize: 15, fontWeight: 800, color: '#5B6577', margin: '28px 0 10px' },
  sub: { fontSize: 14, color: '#5B6577', margin: '0 0 16px', lineHeight: 1.5 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 10, border: '1.5px solid #E6E9F0', fontSize: 15, marginBottom: 12, boxSizing: 'border-box' },
  btn: { width: '100%', padding: '13px 14px', borderRadius: 10, border: 'none', background: '#3056D3', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  ghost: { padding: '9px 14px', borderRadius: 999, border: '1.5px solid #E6E9F0', background: '#fff', color: '#5B6577', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  stats: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  stat: { flex: '1 1 130px', background: '#fff', borderRadius: 14, padding: 14, border: '1px solid #E6E9F0' },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 14, padding: 14, marginBottom: 9, border: '1px solid #E6E9F0' },
  name: { fontSize: 15.5, fontWeight: 700, color: '#0D1526' },
  meta: { fontSize: 12.5, color: '#5B6577', marginTop: 2 },
  note: { fontSize: 13, color: '#1A2333', marginTop: 4, fontStyle: 'italic' },
  approve: { padding: '10px 16px', borderRadius: 10, border: 'none', background: '#0E9F6E', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' },
  reject: { padding: '10px 14px', borderRadius: 10, border: '1.5px solid #F3D2D2', background: '#fff', color: '#DC2626', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' },
  small: { padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E6E9F0', background: '#fff', color: '#1A2333', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  err: { background: '#FDEDED', color: '#B91C1C', padding: '10px 12px', borderRadius: 9, fontSize: 13.5, fontWeight: 600, margin: '10px 0' },
}
