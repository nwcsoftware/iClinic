import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
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
