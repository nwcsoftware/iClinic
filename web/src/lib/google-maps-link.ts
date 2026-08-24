// ---------------------------------------------------------------------------
// Turning a pasted Google Maps link into coordinates.
//
// Doctors share a link from the Maps app; we need latitude/longitude out of it.
// Google uses several URL shapes and there is no public "resolve this link"
// API, so this parses the documented patterns directly and follows short links
// to see what they expand to.
//
// Deliberately conservative: when a link yields no coordinates we say so and
// hand the doctor the map picker, rather than guessing a position. A pin on the
// wrong building sends a patient to the wrong building.
// ---------------------------------------------------------------------------

export type ParsedMapsLink = {
  latitude: number | null
  longitude: number | null
  /** Place name lifted from the URL when present. */
  name: string | null
  /** How confident we are that the coordinates are the actual place. */
  precision: 'exact' | 'approximate' | 'none'
  /** The URL after following any redirects, useful for support. */
  resolvedUrl: string
}

const GOOGLE_HOSTS = [
  'google.com', 'www.google.com', 'maps.google.com', 'goo.gl', 'maps.app.goo.gl',
  'g.co', 'www.google.co.uk',
]

export function looksLikeGoogleMapsUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const host = u.hostname.toLowerCase()
    return GOOGLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

// A place URL can carry coordinates in several places, and they do not mean the
// same thing. Ordered most-trustworthy first:
//
//   !3dLAT!4dLNG   the place's own pin        -> exact
//   ?q=LAT,LNG     an explicit point          -> exact
//   /@LAT,LNG,17z  the CAMERA centre, which is only near the place, not on it
//                                             -> approximate
function extractFromUrl(url: string): Omit<ParsedMapsLink, 'resolvedUrl'> {
  const name = extractName(url)

  // !3d / !4d — the actual place marker inside Google's data blob.
  const data = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/)
  if (data) {
    const lat = Number(data[1]); const lng = Number(data[2])
    if (valid(lat, lng)) return { latitude: lat, longitude: lng, name, precision: 'exact' }
  }

  // ?q=lat,lng or ?query=lat,lng or ?destination=lat,lng
  try {
    const u = new URL(url)
    for (const key of ['q', 'query', 'destination', 'center', 'll']) {
      const v = u.searchParams.get(key)
      if (!v) continue
      const m = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/)
      if (m) {
        const lat = Number(m[1]); const lng = Number(m[2])
        if (valid(lat, lng)) return { latitude: lat, longitude: lng, name, precision: 'exact' }
      }
    }
  } catch { /* not a parseable URL, fall through */ }

  // /@lat,lng,zoom — where the camera was, not necessarily the place.
  const at = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (at) {
    const lat = Number(at[1]); const lng = Number(at[2])
    if (valid(lat, lng)) return { latitude: lat, longitude: lng, name, precision: 'approximate' }
  }

  return { latitude: null, longitude: null, name, precision: 'none' }
}

// "/place/Saint+George+Hospital/..." -> "Saint George Hospital"
function extractName(url: string): string | null {
  const m = url.match(/\/place\/([^/@?]+)/)
  if (!m) return null
  try {
    const decoded = decodeURIComponent(m[1]).replace(/\+/g, ' ').trim()
    // Google sometimes puts a plus-code or a bare coordinate here.
    if (!decoded || /^[-\d.,\s]+$/.test(decoded)) return null
    return decoded.slice(0, 200)
  } catch {
    return null
  }
}

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    // 0,0 is the Atlantic — always a parsing artefact, never a clinic.
    && !(lat === 0 && lng === 0)
}

// Short links (maps.app.goo.gl/...) carry nothing themselves; the coordinates
// only appear in the URL they redirect to. Followed server-side because the
// browser cannot read a cross-origin redirect chain.
export async function resolveGoogleMapsLink(raw: string): Promise<ParsedMapsLink> {
  const input = raw.trim()
  const url = input.startsWith('http') ? input : `https://${input}`

  // Try the pasted URL first — a full link usually already has what we need.
  const direct = extractFromUrl(url)
  if (direct.precision === 'exact') return { ...direct, resolvedUrl: url }

  let resolvedUrl = url
  try {
    // HEAD is often refused by Google here, so use GET and follow redirects.
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Without a browser-ish UA Google serves a consent interstitial that
        // carries no coordinates.
        'User-Agent': 'Mozilla/5.0 (compatible; iClinic/1.0; +https://iclinic.health)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(8000),
    })
    resolvedUrl = res.url || url

    const fromRedirect = extractFromUrl(resolvedUrl)
    if (fromRedirect.precision !== 'none') return { ...fromRedirect, resolvedUrl }

    // Last resort: the coordinates are sometimes only in the page body.
    const body = await res.text()
    const inBody = body.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      ?? body.match(/\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/)
    if (inBody) {
      const lat = Number(inBody[1]); const lng = Number(inBody[2])
      if (valid(lat, lng)) {
        return {
          latitude: lat, longitude: lng,
          name: fromRedirect.name ?? direct.name,
          precision: 'approximate',
          resolvedUrl,
        }
      }
    }
    return { ...fromRedirect, resolvedUrl }
  } catch {
    // Network failure or timeout — fall back to whatever the raw URL gave us
    // (possibly an approximate camera position, possibly nothing).
    return { ...direct, resolvedUrl }
  }
}
