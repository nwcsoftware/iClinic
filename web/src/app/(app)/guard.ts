import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Server-side route guard for the dashboard.
//
// The sidebar decides what to draw; this decides what is allowed. They are
// deliberately separate: a link that is not rendered is still reachable by
// typing the address, so the answer has to live somewhere the address cannot
// route around.
//
// A secretary runs the diary. Prescriptions, patient records and finances are
// medical or commercial, and neither is theirs — so those routes send them
// back before rendering anything, and the APIs behind them refuse too.
// ---------------------------------------------------------------------------

export async function requireNotSecretary() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()

  if (!profile) redirect('/login')
  if (profile.role === 'receptionist') redirect('/dashboard')
}

/** The mirror of the above, for pages only a secretary should open. */
export async function requireSecretaryRole() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()

  if (!profile) redirect('/login')
  if (profile.role !== 'receptionist') redirect('/dashboard')
}

export async function requireDoctor() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()

  if (!profile) redirect('/login')
  if (profile.role !== 'doctor') redirect('/dashboard')
}
