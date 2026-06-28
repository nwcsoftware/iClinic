import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const loginUrl = new URL('/login', request.url)
  return NextResponse.redirect(loginUrl, { status: 302 })
}
