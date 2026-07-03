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

// Resolves the Bearer token to an ACTIVE doctor profile, or null.
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
