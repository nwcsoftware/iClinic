import type { SupabaseClient, User } from '@supabase/supabase-js'

// The mobile app authenticates with a Bearer access token (not cookies).
// Verify it with the service-role client and return the auth user.
export async function getBearerUser(
  request: Request,
  admin: SupabaseClient,
): Promise<User | null> {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
