import { Platform, Linking } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type EmergencyService = {
  key: 'police' | 'ambulance' | 'fire' | 'general'
  label: string
  number: string
}

export type CountryEmergency = {
  code: string
  name: string
  services: EmergencyService[]
}

const STORAGE_KEY = 'iclinic.country'

// Numbers are the official national emergency lines. Where a country has one
// unified number, it's listed once as "general". Lebanon is the primary
// market and is verified against ISF / Lebanese Red Cross / Civil Defense.
export const COUNTRIES: CountryEmergency[] = [
  {
    code: 'LB', name: 'Lebanon',
    services: [
      { key: 'police', label: 'Police (ISF)', number: '112' },
      { key: 'ambulance', label: 'Ambulance (Red Cross)', number: '140' },
      { key: 'fire', label: 'Civil Defense (Fire & Rescue)', number: '125' },
    ],
  },
  {
    code: 'US', name: 'United States',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '911' }],
  },
  {
    code: 'CA', name: 'Canada',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '911' }],
  },
  {
    code: 'GB', name: 'United Kingdom',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '999' }],
  },
  {
    code: 'FR', name: 'France',
    services: [
      { key: 'general', label: 'EU Emergency Number', number: '112' },
      { key: 'police', label: 'Police', number: '17' },
      { key: 'ambulance', label: 'Ambulance (SAMU)', number: '15' },
      { key: 'fire', label: 'Fire (Pompiers)', number: '18' },
    ],
  },
  {
    code: 'DE', name: 'Germany',
    services: [
      { key: 'general', label: 'EU Emergency Number', number: '112' },
      { key: 'police', label: 'Police', number: '110' },
    ],
  },
  {
    code: 'ES', name: 'Spain',
    services: [{ key: 'general', label: 'EU Emergency Number', number: '112' }],
  },
  {
    code: 'IT', name: 'Italy',
    services: [{ key: 'general', label: 'EU Emergency Number', number: '112' }],
  },
  {
    code: 'AU', name: 'Australia',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '000' }],
  },
  {
    code: 'AE', name: 'United Arab Emirates',
    services: [
      { key: 'police', label: 'Police', number: '999' },
      { key: 'ambulance', label: 'Ambulance', number: '998' },
      { key: 'fire', label: 'Fire', number: '997' },
    ],
  },
  {
    code: 'SA', name: 'Saudi Arabia',
    services: [
      { key: 'police', label: 'Police', number: '999' },
      { key: 'ambulance', label: 'Ambulance (Red Crescent)', number: '997' },
      { key: 'fire', label: 'Fire', number: '998' },
    ],
  },
  {
    code: 'EG', name: 'Egypt',
    services: [
      { key: 'police', label: 'Police', number: '122' },
      { key: 'ambulance', label: 'Ambulance', number: '123' },
      { key: 'fire', label: 'Fire', number: '180' },
    ],
  },
  {
    code: 'JO', name: 'Jordan',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '911' }],
  },
  {
    code: 'TR', name: 'Türkiye',
    services: [{ key: 'general', label: 'Police, Fire & Ambulance', number: '112' }],
  },
  {
    code: 'OTHER', name: 'Other / not listed',
    services: [
      { key: 'general', label: 'International emergency number', number: '112' },
      { key: 'general', label: 'Common alternative', number: '911' },
    ],
  },
]

export const DEFAULT_COUNTRY = 'LB'

export function getCountry(code: string): CountryEmergency {
  return COUNTRIES.find((c) => c.code === code) ?? COUNTRIES.find((c) => c.code === DEFAULT_COUNTRY)!
}

// Best-effort guess from the device locale — never trusted blindly, always
// overridable from the picker, and falls back to Lebanon on any failure.
export function detectCountryCode(): string {
  try {
    const locale = Platform.OS === 'web' && typeof navigator !== 'undefined'
      ? navigator.language
      : Intl.DateTimeFormat().resolvedOptions().locale
    const region = locale?.split(/[-_]/)[1]?.toUpperCase()
    if (region && COUNTRIES.some((c) => c.code === region)) return region
  } catch { /* fall through to default */ }
  return DEFAULT_COUNTRY
}

export async function loadSavedCountry(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY)
    if (saved && COUNTRIES.some((c) => c.code === saved)) return saved
  } catch { /* fall through */ }
  return detectCountryCode()
}

export async function saveCountry(code: string): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, code) } catch { /* non-fatal */ }
}

export function dial(number: string): void {
  Linking.openURL(`tel:${number.replace(/\s+/g, '')}`).catch(() => {})
}
