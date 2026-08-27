import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// These are compiled into the bundle, so a native build has no .env to fall
// back on: whatever EAS supplies at build time is all there is.
//
// They used to be asserted non-null, which meant a build made without them
// threw inside createClient before anything rendered — the app opened and shut
// instantly with nothing to read. Now the client is constructed with harmless
// placeholders and the problem is reported, so the screen says which variable
// is missing instead of disappearing.
const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const configError: string | null = (() => {
  const missing = [
    !SUPABASE_URL && 'EXPO_PUBLIC_SUPABASE_URL',
    !SUPABASE_ANON && 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    !process.env.EXPO_PUBLIC_API_URL && 'EXPO_PUBLIC_API_URL',
  ].filter(Boolean)
  return missing.length ? missing.join(', ') : null
})()

export const supabase = createClient(SUPABASE_URL ?? 'https://unset.invalid', SUPABASE_ANON ?? 'unset', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ── Patient auth via Supabase email OTP ───────────────────────────────────
// Step 1: call sendOtp(email) → Supabase emails a 6-digit code automatically
// Step 2: call verifyOtp(email, token) → returns session; use supabase client normally after

export async function sendOtp(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
}

export async function verifyOtp(email: string, token: string) {
  return supabase.auth.verifyOtp({ email, token, type: 'email' })
}

export async function signOut() {
  return supabase.auth.signOut()
}
