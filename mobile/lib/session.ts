import { supabase } from './supabase'
import type { PatientInfo } from './api'
import type { DoctorMe, Access } from './doctorApi'

const API_URL = process.env.EXPO_PUBLIC_API_URL!

// How long any single login-path request may hang before we give up. Long
// enough for a slow mobile connection, short enough that a dead network shows
// an error instead of a spinner that never resolves.
export const LOGIN_TIMEOUT_MS = 15000

export class TimeoutError extends Error {
  constructor() { super('The connection timed out. Check your internet and try again.') }
}

// AbortSignal.timeout exists in Hermes and on web, but throws a DOMException
// whose message ("signal is aborted without reason") means nothing to a user,
// so it is translated here.
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = LOGIN_TIMEOUT_MS) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'TimeoutError' || name === 'AbortError') throw new TimeoutError()
    throw e
  }
}

export type Me =
  | { kind: 'doctor'; doctor: DoctorMe; access: Access | null }
  | { kind: 'patient'; patient: PatientInfo | null; needs_profile?: boolean }

// Who is this session? One request, one token validation.
//
// This used to be two calls in sequence — ask whether the user is a doctor,
// then, once that came back empty, ask for the patient record. A patient paid
// for both round trips every single time they opened the app.
export async function getMe(): Promise<Me> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const res = await fetchWithTimeout(`${API_URL}/api/me`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Could not load your account (${res.status})`)
  return body as Me
}
