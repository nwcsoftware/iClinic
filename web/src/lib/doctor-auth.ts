import type { SupabaseClient } from '@supabase/supabase-js'
import { getBearerUser } from './patient-auth'

export type DoctorProfile = {
  id: string
  full_name: string
  specialty: string | null
  specialty_id: string | null
  avatar_url: string | null
  is_active: boolean
}

export type Subscription = {
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  plan: 'monthly' | 'yearly'
  price_usd: number
  current_period_end: string
  trial_end: string | null
  cancel_at_period_end: boolean
  provider: string
}

export type Access = {
  has_access: boolean
  status: Subscription['status'] | 'none'
  days_left: number
  is_trial: boolean
  in_grace: boolean
  current_period_end: string | null
  price_usd: number
  billing_enabled: boolean
}

const GRACE_DAYS = 7

// Resolves the Bearer token to an ACTIVE doctor profile, or null.
// Deliberately does NOT check the subscription: unpaid doctors must still be
// able to sign in and reach the paywall.
export async function getBearerDoctor(
  request: Request,
  admin: SupabaseClient,
): Promise<DoctorProfile | null> {
  const user = await getBearerUser(request, admin)
  if (!user) return null
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, specialty, specialty_id, avatar_url, is_active, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!data || data.role !== 'doctor' || !data.is_active) return null
  return data as DoctorProfile
}

// The single access rule, mirrored from doctor_has_access() in the database.
// Until migration 0004 is applied the table does not exist — PostgREST reports
// that as PGRST205 (and Postgres as 42P01). Billing is then treated as not yet
// enabled so nothing is locked and the app keeps working.
const TABLE_MISSING = new Set(['42P01', 'PGRST205'])

export async function getAccess(admin: SupabaseClient, doctorId: string): Promise<Access> {
  const { data, error } = await admin
    .from('doctor_subscriptions')
    .select('status, plan, price_usd, current_period_end, trial_end, cancel_at_period_end, provider')
    .eq('doctor_id', doctorId)
    .maybeSingle()

  if (error && TABLE_MISSING.has(error.code)) {
    return {
      has_access: true, status: 'active', days_left: 0, is_trial: false, in_grace: false,
      current_period_end: null, price_usd: 9.99, billing_enabled: false,
    }
  }

  if (!data) {
    return {
      has_access: false, status: 'none', days_left: 0, is_trial: false, in_grace: false,
      current_period_end: null, price_usd: 9.99, billing_enabled: true,
    }
  }

  const sub = data as Subscription
  const end = new Date(sub.current_period_end).getTime()
  const now = Date.now()
  const live = sub.status === 'trialing' || sub.status === 'active' || sub.status === 'past_due'
  const graceMs = sub.status === 'past_due' ? GRACE_DAYS * 86_400_000 : 0

  return {
    has_access: live && end + graceMs > now,
    status: sub.status,
    days_left: Math.max(0, Math.ceil((end - now) / 86_400_000)),
    is_trial: sub.status === 'trialing',
    in_grace: sub.status === 'past_due' && end <= now && end + graceMs > now,
    current_period_end: sub.current_period_end,
    price_usd: Number(sub.price_usd ?? 9.99),
    billing_enabled: true,
  }
}

// Use this in every route a paying doctor is entitled to. Returns null when the
// caller is not a doctor OR has no live subscription — the caller answers 401/402.
export async function requireSubscribedDoctor(
  request: Request,
  admin: SupabaseClient,
): Promise<{ doctor: DoctorProfile; access: Access } | { doctor: null; access: Access | null }> {
  const doctor = await getBearerDoctor(request, admin)
  if (!doctor) return { doctor: null, access: null }
  const access = await getAccess(admin, doctor.id)
  if (!access.has_access) return { doctor: null, access }
  return { doctor, access }
}
