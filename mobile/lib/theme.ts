// iClinic design system — colors, spacing, type, radii.
// Deep indigo-blue brand with a calm, clinical neutral scale.

export const colors = {
  brand: '#3056D3',
  brandDark: '#1F3BA8',
  brandSoft: '#EAEEFC',
  brandSofter: '#F4F6FE',

  ink: '#0D1526',
  text: '#1A2333',
  textMuted: '#5B6577',
  textFaint: '#93A0B4',

  bg: '#F5F6FA',
  card: '#FFFFFF',
  border: '#E6E9F0',
  borderStrong: '#D4D9E3',

  success: '#0E9F6E',
  successBg: '#E6F7F1',
  danger: '#DC2626',
  dangerBg: '#FDEDED',
  amber: '#B45309',
  amberBg: '#FEF6E7',

  bubbleUser: '#3056D3',
  bubbleBot: '#FFFFFF',

  tabInactive: '#93A0B4',
  star: '#F5A623',
  skeleton: '#E9ECF3',
}

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, full: 999 }

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 }

export const type = {
  hero: { fontSize: 28, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.5 },
  h1: { fontSize: 22, fontWeight: '800' as const, color: colors.ink, letterSpacing: -0.3 },
  h2: { fontSize: 17, fontWeight: '700' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  sub: { fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.textMuted },
  small: { fontSize: 12, color: colors.textFaint },
}

// Soft elevation used on cards (subtle on iOS/web, elevation on Android).
export const shadow = {
  card: {
    shadowColor: '#101c3d',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#101c3d',
    shadowOpacity: 0.12,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
}

export const statusColors: Record<string, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: '#EAEEFC', fg: '#2748B8', label: 'Scheduled' },
  in_progress: { bg: '#FEF6E7', fg: '#B45309', label: 'In progress' },
  completed: { bg: '#E6F7F1', fg: '#0E7E58', label: 'Completed' },
  cancelled: { bg: '#EEF0F4', fg: '#7A8496', label: 'Cancelled' },
  no_show: { bg: '#FDEDED', fg: '#B91C1C', label: 'No show' },
}

// MaterialCommunityIcons names per specialty (via @expo/vector-icons).
export const specialtyIcon: Record<string, string> = {
  general_practice: 'stethoscope',
  family_medicine: 'account-group-outline',
  internal_medicine: 'clipboard-pulse-outline',
  dermatology: 'hand-back-right-outline',
  cardiology: 'heart-pulse',
  pediatrics: 'baby-face-outline',
  orthopedics: 'bone',
  gynecology: 'human-pregnant',
  otolaryngology: 'ear-hearing',
  ophthalmology: 'eye-outline',
  psychiatry: 'brain',
  dentistry: 'tooth-outline',
  neurology: 'head-flash-outline',
  gastroenterology: 'stomach',
  endocrinology: 'test-tube',
  urology: 'water-outline',
  pulmonology: 'lungs',
  rheumatology: 'hand-extended-outline',
  nephrology: 'water-plus-outline',
  allergy_immunology: 'flower-outline',
}
export const DEFAULT_SPECIALTY_ICON = 'stethoscope'

export function iconForSpecialty(slug: string | null | undefined): string {
  return specialtyIcon[slug ?? ''] ?? DEFAULT_SPECIALTY_ICON
}
