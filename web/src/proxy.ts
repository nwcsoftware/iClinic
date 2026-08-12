import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith('/api/')) return supabaseResponse

  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  // /pay is the card checkout and its return URL. It must stay public: the
  // doctor opens it from the mobile app and Areeba redirects the browser back
  // to it, and neither carries a staff session cookie. It is safe because the
  // order id is unguessable and the pages expose only an amount — activation
  // is decided by asking the gateway server-side, never by who is browsing.
  // /admin has its own gate: every request it makes carries ADMIN_API_KEY and
  // the API rejects anything else, so the page itself shows nothing without it.
  // It is listed here only so it does not bounce to the staff login.
  // The marketing page and the three policies must be readable by anyone —
  // payment providers review them before approving a merchant account, and a
  // policy behind a login is the same as no policy at all.
  const publicRoutes = [
    '/', '/login', '/register', '/pay', '/admin',
    '/terms', '/privacy', '/refund-policy',
  ]
  const isPublic = publicRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
