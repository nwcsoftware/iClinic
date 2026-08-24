import Link from 'next/link'
import type { Metadata } from 'next'
import {
  MessageSquareHeart, CalendarCheck, Pill, PhoneCall, MapPin, ShieldCheck,
  CalendarClock, ClipboardList, Users, Building2, ArrowRight, ChevronDown,
} from 'lucide-react'
import { org, legalReady, missingLegalFields } from '@/lib/legal'
import FloatingNav from '@/components/landing/FloatingNav'
import Reveal from '@/components/landing/Reveal'
import LebanonMap from '@/components/landing/LebanonMap'

export const metadata: Metadata = {
  title: 'iClinic — The right doctor, in minutes',
  description:
    'iClinic helps people in Lebanon describe how they feel, find the right specialist, book a visit and keep their prescriptions in one place — and gives doctors one place to run their practice.',
}

const PATIENT_FEATURES = [
  {
    icon: MessageSquareHeart,
    title: 'Describe how you feel',
    body: 'Say it in your own words. The assistant works out which speciality fits and points you there. It guides — it never diagnoses.',
  },
  {
    icon: CalendarCheck,
    title: 'Book in a couple of taps',
    body: 'Pick a doctor, choose a time that is actually free, and the visit is confirmed straight away. No calls, no waiting for someone to pick up.',
  },
  {
    icon: Pill,
    title: 'Read your prescriptions',
    body: 'Exactly what to take, how much, at which hours, and for how long — written by your doctor, not copied off a paper you might lose.',
  },
  {
    icon: PhoneCall,
    title: 'Help in an emergency',
    body: 'One button brings up the emergency numbers for where you are and dials them for you.',
  },
]

const DOCTOR_FEATURES = [
  {
    icon: CalendarClock,
    title: 'Your week, your rules',
    body: 'Set the hours you work at each place, block the days you do not, and let bookings arrive around the clock without a phone ringing.',
  },
  {
    icon: Building2,
    title: 'Every place you work',
    body: 'Hospital on Monday, private clinic on Thursday. Add each one, put it on the map, and patients see where their appointment will be.',
  },
  {
    icon: ClipboardList,
    title: 'The history before the visit',
    body: 'Allergies, chronic conditions, past surgeries and previous visits — on screen before the patient sits down.',
  },
  {
    icon: Users,
    title: 'Prescriptions that are clear',
    body: 'Dosage, times of day and duration, sent to the patient in a form they can actually follow.',
  },
]

const CONNECTED_STEPS = [
  {
    step: '01',
    title: 'The patient writes it once',
    body: 'Allergies, chronic conditions, blood type, past surgeries. Entered on their own phone, in their own time.',
  },
  {
    step: '02',
    title: 'The doctor sees it at the visit',
    body: 'A timeline of appointments, diagnoses and prescriptions — no forms to fill in at reception, nothing to remember under pressure.',
  },
  {
    step: '03',
    title: 'The visit adds to it',
    body: 'What was diagnosed, what was treated and what was prescribed goes back to the same record, ready for whoever sees them next.',
  },
]

const MAP_POINTS = [
  'Browse hospitals, clinics and medical centres across the country',
  'See which doctors work at each one, and on which days',
  'Filter by speciality when you already know who you need',
]

const PATIENT_APP_URL = 'https://iclinic-app.vercel.app'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <FloatingNav />

      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-slate-950">
        {/* Colour fields, positioned off-centre so the light reads as coming
            from somewhere rather than sitting behind the text. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="icl-aurora left-[-18%] top-[-14%] h-[46rem] w-[46rem] bg-indigo-600/35" />
          <div
            className="icl-aurora right-[-14%] top-[8%] h-[38rem] w-[38rem] bg-sky-500/25"
            style={{ animationDelay: '-9s' }}
          />
          <div
            className="icl-aurora bottom-[-22%] left-[26%] h-[40rem] w-[40rem] bg-teal-400/20"
            style={{ animationDelay: '-17s' }}
          />
          <div className="icl-grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-slate-950" />
        </div>

        <div className="relative mx-auto w-full max-w-4xl px-6 pb-24 pt-32 text-center sm:pt-36">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[13px] font-medium text-indigo-200 backdrop-blur">
              <MapPin className="h-3.5 w-3.5" />
              Built for {org.location}
            </span>
          </Reveal>

          <Reveal delay={90}>
            <h1 className="mt-7 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl">
              The right doctor,
              <span className="block bg-gradient-to-r from-indigo-300 via-sky-300 to-teal-200 bg-clip-text text-transparent">
                in minutes
              </span>
            </h1>
          </Reveal>

          <Reveal delay={170}>
            <p className="mx-auto mt-7 max-w-xl text-pretty text-lg leading-8 text-slate-300">
              Describe how you feel. Find the specialist who treats it. Book the visit, and keep
              every prescription and past appointment in one place.
            </p>
          </Reveal>

          <Reveal delay={250}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={PATIENT_APP_URL}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-slate-900 shadow-lg shadow-indigo-950/40 transition-all hover:bg-slate-100 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                Open the patient app
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:w-auto"
              >
                I&apos;m a doctor
              </Link>
            </div>
          </Reveal>

          <Reveal delay={330}>
            <p className="mt-8 text-sm text-slate-400">
              Free for patients. Not for emergencies — call 112 in Lebanon.
            </p>
          </Reveal>
        </div>

        <ChevronDown
          aria-hidden
          className="absolute bottom-7 left-1/2 h-5 w-5 -translate-x-1/2 animate-bounce text-white/35"
        />
      </section>

      {!legalReady() ? (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-center text-sm text-amber-900">
          Set {missingLegalFields().join(', ')} before submitting this site to a payment provider.
        </div>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* For patients                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-600">
            For patients
          </p>
          <h2 className="mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Finding care should not be the hard part
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            You know something is wrong. You should not also have to know which kind of doctor
            treats it, or who has a free slot on Thursday.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PATIENT_FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="group h-full rounded-3xl border border-slate-200 bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-[0_20px_50px_-20px_rgba(79,70,229,0.35)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <f.icon className="h-[22px] w-[22px]" />
                </div>
                <h3 className="mt-6 text-xl font-semibold tracking-tight text-slate-900">{f.title}</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* For doctors                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-slate-950 py-24 sm:py-32">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="icl-aurora right-[-10%] top-[-10%] h-[34rem] w-[34rem] bg-indigo-600/25" />
          <div
            className="icl-aurora bottom-[-20%] left-[-8%] h-[30rem] w-[30rem] bg-teal-400/15"
            style={{ animationDelay: '-12s' }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-300">
              For doctors
            </p>
            <h2 className="mt-4 max-w-2xl text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Your practice, without the paperwork around it
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">
              One place for your schedule, the places you work, your patients and what you
              prescribe them.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {DOCTOR_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition-colors duration-300 hover:border-white/20 hover:bg-white/[0.07]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-teal-300">
                    <f.icon className="h-[22px] w-[22px]" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight text-white">{f.title}</h3>
                  <p className="mt-3 text-[15px] leading-7 text-slate-300">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={340}>
            <Link
              href="/register"
              className="group mt-12 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-slate-900 transition-all hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Create a doctor account
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Healthcare map                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-600">
              The map
            </p>
            <h2 className="mt-4 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Every hospital and clinic, where it actually is
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Doctors place their own pin — from a Google Maps link, from where they are standing,
              or by dropping it on the map themselves. So the point you navigate to is the door you
              walk through, not a guess made from an address.
            </p>
            <ul className="mt-8 space-y-3">
              {MAP_POINTS.map((line) => (
                <li key={line} className="flex gap-3 text-[15px] leading-7 text-slate-700">
                  <MapPin className="mt-1.5 h-4 w-4 shrink-0 text-teal-600" />
                  {line}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.6)]">
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="icl-aurora left-[10%] top-[10%] h-72 w-72 bg-indigo-600/25" />
                <div
                  className="icl-aurora bottom-[5%] right-[5%] h-64 w-64 bg-teal-400/20"
                  style={{ animationDelay: '-8s' }}
                />
              </div>
              <LebanonMap className="relative mx-auto h-[26rem] w-full" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Connected care                                                    */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-slate-200 bg-slate-50 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <h2 className="max-w-2xl text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              The two halves are the same system
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              What a patient records and what a doctor sees are not two databases that have to be
              kept in step. They are one.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {CONNECTED_STEPS.map((s, i) => (
              <Reveal key={s.step} delay={i * 90}>
                <div className="h-full rounded-3xl border border-slate-200 bg-white p-8">
                  <span className="text-sm font-bold tracking-[0.16em] text-indigo-600">{s.step}</span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-7 text-slate-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Final CTA                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative isolate overflow-hidden bg-slate-950 py-28 sm:py-36">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="icl-aurora left-1/2 top-[-30%] h-[42rem] w-[42rem] -translate-x-1/2 bg-indigo-600/30" />
          <div
            className="icl-aurora bottom-[-30%] left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 bg-teal-400/15"
            style={{ animationDelay: '-11s' }}
          />
          <div className="icl-grain absolute inset-0 opacity-[0.06] mix-blend-overlay" />
        </div>

        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl">
            Start where you are
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-slate-300">
            Patients open the app and book. Doctors create an account and set up the places they
            work. Both take a few minutes.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={PATIENT_APP_URL}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-slate-900 transition-all hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
            >
              Open the patient app
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-[15px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:w-auto"
            >
              Create a doctor account
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Safety                                                            */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="flex gap-4 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-7">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h2 className="font-semibold text-slate-900">A note on safety</h2>
            <p className="mt-2 text-[15px] leading-7 text-slate-700">
              The assistant in {org.product} suggests which kind of doctor to see. It does not
              diagnose, treat, or give medical advice, and it is never a substitute for a qualified
              professional. In an emergency call your local emergency number — in Lebanon that is
              112 for police, 140 for the Red Cross ambulance and 125 for Civil Defence.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Contact + footer                                                  */}
      {/* ---------------------------------------------------------------- */}
      <footer id="contact" className="border-t border-slate-200 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <h2 className="font-semibold text-slate-900">Contact</h2>
              <p className="mt-2 text-[15px] leading-7 text-slate-600">
                {org.legalName ? <>{org.legalName}, {org.location}<br /></> : null}
                Email{' '}
                <a className="text-indigo-600 underline underline-offset-2" href={`mailto:${org.email}`}>
                  {org.email}
                </a>
                {org.phone ? <><br />Phone {org.phone}</> : null}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/login"
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </div>
          </div>

          <nav className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-200 pt-6 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/refund-policy" className="hover:text-slate-900">Refunds &amp; Cancellation</Link>
          </nav>
          <p className="mt-6 text-sm text-slate-500">
            © {new Date().getFullYear()} {org.legalName || org.product}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
