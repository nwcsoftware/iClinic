import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StringKey } from './i18n'

// ---------------------------------------------------------------------------
// The spotlight walkthrough.
//
// The app opens normally and the tour points at the real controls, so nothing
// here describes the UI a second time: a step names a target, the screen it
// lives on, and what to say about it. Adding, reordering or dropping a step is
// an edit to TOUR_STEPS and nothing else.
// ---------------------------------------------------------------------------

/** Which patient tab a step's target lives on. */
export type TourScreen = 'home' | 'doctors' | 'visits' | 'profile'

export type TourStep = {
  /** Matches the id given to a <TourTarget>. */
  id: string
  screen: TourScreen
  title: StringKey
  body: StringKey
  /** Where the message should sit if there is room. 'auto' picks the roomier side. */
  placement?: 'auto' | 'above' | 'below'
}

export const TOUR_STEPS: TourStep[] = [
  { id: 'chatbot',   screen: 'home',    title: 'tour.chatbot.title',   body: 'tour.chatbot.body' },
  { id: 'doctorsTab', screen: 'home',   title: 'tour.doctors.title',   body: 'tour.doctors.body',   placement: 'above' },
  { id: 'doctorSearch', screen: 'doctors', title: 'tour.search.title', body: 'tour.search.body' },
  { id: 'mapOrb',    screen: 'doctors', title: 'tour.map.title',       body: 'tour.map.body',       placement: 'above' },
  { id: 'visitsTab', screen: 'visits',  title: 'tour.visits.title',    body: 'tour.visits.body',    placement: 'above' },
  { id: 'emergency', screen: 'visits',  title: 'tour.emergency.title', body: 'tour.emergency.body', placement: 'above' },
  { id: 'profileTab', screen: 'profile', title: 'tour.profile.title',  body: 'tour.profile.body',   placement: 'above' },
]

// --- persistence -----------------------------------------------------------
export const TOUR_SEEN_KEY = 'iclinic.tourSeen'

export async function hasSeenTour(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(TOUR_SEEN_KEY)) === '1' } catch { return false }
}
export async function markTourSeen(): Promise<void> {
  try { await AsyncStorage.setItem(TOUR_SEEN_KEY, '1') } catch { /* non-fatal */ }
}

// --- measurement -----------------------------------------------------------
export type Rect = {
  x: number; y: number; width: number; height: number
  /**
   * The target's own corner radius, when it can be read. The cutout follows the
   * control's real shape rather than a fixed corner, so a round button gets a
   * round hole instead of a rounded square around it.
   */
  radius?: number
}

// Web only: the shape the target actually draws.
//
// A <TourTarget> wraps its child in a plain View, and that wrapper describes
// layout, not paint. The map orb is the clear case: it overhangs its slot with
// a negative margin, so the slot measures 58x32 while the button people see is
// a 58x58 circle. Highlighting the slot produces a squashed rounded rectangle
// over a round button.
//
// So when a descendant is big enough to BE the target and carries a corner
// radius, its box and radius are used instead. The 60% floor keeps a small
// round icon inside a large card from speaking for the card.
type Shape = { x?: number; y?: number; width?: number; height?: number; radius?: number }

function radiusOf(e: Element): number {
  const cs = getComputedStyle(e)
  const v = cs.borderTopLeftRadius
  if (!v) return 0
  if (v.endsWith('%')) {
    const r = e.getBoundingClientRect()
    return (parseFloat(v) / 100) * Math.min(r.width, r.height)
  }
  return parseFloat(v) || 0
}

function readShape(node: unknown, box: Rect): Shape {
  const el = node as Element | null
  if (!el || typeof (el as { querySelectorAll?: unknown }).querySelectorAll !== 'function') return {}

  const own = radiusOf(el)
  if (own > 0) return { radius: own }

  const area = box.width * box.height
  let best: { r: DOMRect; radius: number } | null = null
  for (const child of Array.from(el.querySelectorAll('*'))) {
    const r = child.getBoundingClientRect()
    if (r.width * r.height < area * 0.6) continue
    const rad = radiusOf(child)
    if (rad > 0 && (!best || rad > best.radius)) best = { r, radius: rad }
  }
  if (!best) return {}
  return { x: best.r.x, y: best.r.y, width: best.r.width, height: best.r.height, radius: best.radius }
}

type Registry = Map<string, View>

type TourCtx = {
  active: boolean
  index: number
  step: TourStep | null
  total: number
  start: () => void
  next: () => void
  skip: () => void
  register: (id: string, node: View | null) => void
  /** Rect of the current target in window coordinates, null until measured. */
  rect: Rect | null
  /** Re-measure the current target (after a rotation, scroll or layout change). */
  remeasure: () => void
  /**
   * How the tour changes screen. The shell owns tab state, and the shell sits
   * inside this provider, so it hands the navigator in rather than the provider
   * reaching for state it cannot see.
   */
  setNavigator: (fn: (screen: TourScreen) => void) => void
}

const Ctx = createContext<TourCtx | null>(null)

export function useTour(): TourCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}

/**
 * Wraps a real control so the tour can find and measure it.
 *
 * It renders a plain View, so pass `style` when the child was carrying layout
 * (a flex value, for instance) or the wrapper will change how it sits.
 */
export function TourTarget({
  id, children, style,
}: {
  id: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const ref = useRef<View | null>(null)
  const { register } = useTour()

  useEffect(() => {
    register(id, ref.current)
    return () => register(id, null)
  }, [id, register])

  return (
    <View ref={ref} style={style} collapsable={false}>
      {children}
    </View>
  )
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const registry = useRef<Registry>(new Map())
  const navigator = useRef<(screen: TourScreen) => void>(() => {})

  const setNavigator = useCallback((fn: (screen: TourScreen) => void) => {
    navigator.current = fn
  }, [])

  const step = active ? (TOUR_STEPS[index] ?? null) : null

  const register = useCallback((id: string, node: View | null) => {
    if (node) registry.current.set(id, node)
    else registry.current.delete(id)
  }, [])

  const measure = useCallback((id: string, attempt = 0) => {
    const node = registry.current.get(id)
    if (!node) {
      // The screen may still be mounting. Retry briefly, then give up and let
      // the step render centred rather than stalling the tour.
      if (attempt < 12) setTimeout(() => measure(id, attempt + 1), 60)
      else setRect(null)
      return
    }
    // On web a View's ref is the DOM node, so an off-screen target can be
    // brought into view before it is measured.
    const el = node as unknown as { scrollIntoView?: (o: object) => void }
    if (typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
    }
    node.measureInWindow((x, y, width, height) => {
      if (!width && !height) {
        if (attempt < 12) setTimeout(() => measure(id, attempt + 1), 60)
        return
      }
      const shape = readShape(node, { x, y, width, height })
      setRect({
        x: shape.x ?? x,
        y: shape.y ?? y,
        width: shape.width ?? width,
        height: shape.height ?? height,
        radius: shape.radius,
      })
    })
  }, [])

  const goTo = useCallback((i: number) => {
    const s = TOUR_STEPS[i]
    if (!s) return
    setRect(null)
    navigator.current(s.screen)
    setIndex(i)
    // Let the screen commit before measuring.
    setTimeout(() => measure(s.id), 80)
  }, [measure])

  const start = useCallback(() => {
    setActive(true)
    setIndex(0)
    setRect(null)
    const first = TOUR_STEPS[0]
    navigator.current(first.screen)
    setTimeout(() => measure(first.id), 120)
  }, [measure])

  const finish = useCallback(() => {
    setActive(false)
    setRect(null)
    markTourSeen()
  }, [])

  const next = useCallback(() => {
    if (index + 1 >= TOUR_STEPS.length) { finish(); return }
    goTo(index + 1)
  }, [index, finish, goTo])

  const remeasure = useCallback(() => {
    if (step) measure(step.id)
  }, [step, measure])

  const value = useMemo<TourCtx>(() => ({
    active, index, step, total: TOUR_STEPS.length,
    start, next, skip: finish, register, rect, remeasure, setNavigator,
  }), [active, index, step, start, next, finish, register, rect, remeasure, setNavigator])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
