'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Stethoscope } from 'lucide-react'

// ---------------------------------------------------------------------------
// The nav that follows the page.
//
// Sign in and sign up are the only two things anyone needs from this page, so
// they never scroll away. Over the dark hero the bar is invisible and its
// contents are light; past the hero it condenses into a glass pill so it stays
// readable on white. Nothing here is decorative — the state change exists
// because white-on-white is unreadable.
//
// Both actions are real links, so they are tabbable, work with the keyboard,
// open in a new tab on middle-click, and survive JavaScript failing to load.
// ---------------------------------------------------------------------------

export default function FloatingNav() {
  const [condensed, setCondensed] = useState(false)

  useEffect(() => {
    // The hero is the full first viewport; condense a little before its end so
    // the change lands while the bar is still over dark pixels.
    const onScroll = () => setCondensed(window.scrollY > window.innerHeight * 0.72)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-6 sm:pt-5">
      <nav
        aria-label="Primary"
        className={[
          'pointer-events-auto flex w-full max-w-5xl items-center gap-3 rounded-full transition-all duration-500 ease-out',
          condensed
            ? 'border border-slate-200/80 bg-white/80 px-3 py-2 shadow-[0_8px_30px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:px-4'
            : 'border border-white/10 bg-white/[0.04] px-3 py-2 backdrop-blur-md sm:px-4',
        ].join(' ')}
      >
        <Link
          href="/"
          className={[
            'flex items-center gap-2 rounded-full px-2 py-1 text-[15px] font-bold tracking-tight transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
            condensed ? 'text-slate-900' : 'text-white',
          ].join(' ')}
        >
          <Stethoscope className={condensed ? 'h-[18px] w-[18px] text-indigo-600' : 'h-[18px] w-[18px] text-indigo-300'} />
          iClinic
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/login"
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
              condensed
                ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                : 'text-white/85 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className={[
              'rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all',
              'hover:bg-indigo-500 hover:shadow-md',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400',
            ].join(' ')}
          >
            Sign up
          </Link>
        </div>
      </nav>
    </header>
  )
}
