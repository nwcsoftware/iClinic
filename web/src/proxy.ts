import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Vercel assigns every project a *.vercel.app address and there is no way to
// remove it, so the old one is sent here instead: existing links keep working,
// and there is exactly one address that is "the site".
//
// Only the production alias is matched. Preview deployments
// (iclinic-<hash>-....vercel.app) keep serving themselves — checking a build
// before it goes live is the entire point of them.
const LEGACY_HOST = 'iclinic-web.vercel.app'
const CANONICAL_HOST = 'app.iclinic.health'

export async function proxy(request: NextRequest) {
  // 308 rather than 302: it is permanent, and it preserves the method and body,
  // so a webhook still pointed at the old host keeps working instead of having
  // its POST quietly turned into a GET.
  if (request.headers.get('host') === LEGACY_HOST) {
    const url = new URL(request.url)
    url.protocol = 'https:'
    url.host = CANONICAL_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

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
