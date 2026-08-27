// Where the user is, in a browser.
//
// Same shape as the native version so callers never branch on platform. The
// browser prompts for permission on the first call, and only ever from a real
// tap, which is why nothing here asks until the user presses the button.

export type Fix = { latitude: number; longitude: number; accuracy?: number }

export type GeolocateResult =
  | { ok: true; fix: Fix }
  | { ok: false; reason: 'denied' | 'unavailable' }

export function getCurrentLocation(): Promise<GeolocateResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, reason: 'unavailable' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        ok: true,
        fix: {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        },
      }),
      (err) => resolve({
        ok: false,
        reason: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    )
  })
}
