import { LocationManager } from '@maplibre/maplibre-react-native'

// Where the user is, on a device.
//
// MapLibre already ships a location manager, so this needs no extra dependency
// and no separate permission plumbing: requestPermissions() puts up the system
// prompt on both platforms and resolves false if the user says no.
//
// The web build has its own version of this file using navigator.geolocation,
// which phones do not have.

export type Fix = { latitude: number; longitude: number; accuracy?: number }

export type GeolocateResult =
  | { ok: true; fix: Fix }
  | { ok: false; reason: 'denied' | 'unavailable' }

export async function getCurrentLocation(): Promise<GeolocateResult> {
  try {
    const granted = await LocationManager.requestPermissions()
    if (!granted) return { ok: false, reason: 'denied' }

    const position = await LocationManager.getCurrentPosition()
    if (!position) return { ok: false, reason: 'unavailable' }

    return {
      ok: true,
      fix: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      },
    }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
