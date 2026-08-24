'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Reveals its children once, as they scroll into view.
//
// The hidden state is applied by this component rather than in the markup, so
// a visitor whose JavaScript never runs sees an ordinary, fully visible page
// instead of a blank one. `once` is deliberate: content that re-animates every
// time you scroll past it is irritating on a second read.
//
// The fallback matters more than the effect does. An IntersectionObserver that
// never reports — a hidden tab, a background render, a browser quirk — would
// otherwise leave the page at opacity 0, which is a far worse failure than a
// missing animation. An observer always delivers a first callback for anything
// it observes, whether or not it is on screen; if that never arrives, the
// element simply shows itself.
const FALLBACK_MS = 1000

export default function Reveal({
  children, delay = 0, className = '',
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    el.classList.add('js-reveal')
    el.style.transitionDelay = `${delay}ms`

    const show = () => el.classList.add('is-in')
    let reported = false

    const io = new IntersectionObserver(
      (entries) => {
        reported = true
        for (const e of entries) {
          if (!e.isIntersecting) continue
          show()
          io.unobserve(e.target)
        }
      },
      // A little before the element is fully on screen, so the motion finishes
      // roughly as the reader arrives at it.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )
    io.observe(el)

    const safety = window.setTimeout(() => { if (!reported) show() }, FALLBACK_MS)

    return () => {
      io.disconnect()
      window.clearTimeout(safety)
    }
  }, [delay])

  return <div ref={ref} className={className}>{children}</div>
}
