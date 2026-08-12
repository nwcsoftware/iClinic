import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Stethoscope, CalendarCheck, Pill, ShieldCheck, MessageSquareHeart, PhoneCall, Check,
} from 'lucide-react'
import { org, legalReady, missingLegalFields } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'iClinic — Find the right doctor and book in minutes',
  description:
    'iClinic helps patients in Lebanon describe their symptoms, find the right specialist, book an appointment and read their prescriptions. Doctors manage their schedule, patients and prescriptions for $9.99 a month.',
}

const PATIENT_FEATURES = [
  { icon: MessageSquareHeart, title: 'Describe how you feel', body: 'Tell the assistant your symptoms and it points you to the right speciality. It guides you — it never diagnoses.' },
  { icon: CalendarCheck, title: 'Book in a couple of taps', body: 'Pick a doctor, choose a free time, and the visit is confirmed straight away.' },
  { icon: Pill, title: 'Read your prescriptions', body: 'See exactly what to take, how much, at which hours, and for how long.' },
  { icon: PhoneCall, title: 'Help in an emergency', body: 'One button shows your local emergency numbers and dials them for you.' },
]

const DOCTOR_FEATURES = [
  'Appear in the patient app and assistant results',
  'Accept online bookings around the clock',
  'Set your weekly hours and block days off',
  'See your patient list, allergies and visit history',
  'Write prescriptions with dosage, times and duration',
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <span className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
            <Stethoscope className="h-5 w-5 text-indigo-600" />
            {org.product}
          </span>
          <nav className="ml-auto flex items-center gap-5 text-sm font-medium text-slate-600">
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#contact" className="hover:text-slate-900">Contact</a>
            <Link
              href="/login"
              className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
            >
              Staff sign in
            </Link>
          </nav>
        </div>
      </header>

      {!legalReady() ? (
        <div className="border-b border-amber-300 bg-amber-50 px-6 py-3 text-center text-sm text-amber-900">
          Set {missingLegalFields().join(', ')} before submitting this site to a payment provider.
        </div>
      ) : null}

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          The right doctor, in minutes
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-600">
          {org.product} helps people in {org.location} describe how they feel, find the right
          specialist, book a visit, and keep their prescriptions in one place.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="https://iclinic-app.vercel.app"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Open the patient app
          </a>
          <Link
            href="/register"
            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            I&apos;m a doctor
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Free for patients. Not for emergencies — call 112 in Lebanon.
        </p>
      </section>

      {/* For patients */}
      <section className="border-t bg-slate-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">For patients</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {PATIENT_FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border bg-white p-6">
                <f.icon className="h-6 w-6 text-indigo-600" />
                <h3 className="mt-4 font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">For doctors</h2>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-slate-600">
            One subscription to appear in the patient app and run your practice. Every new doctor
            account starts with a free trial.
          </p>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-indigo-600 p-8">
              <p className="text-sm font-semibold text-indigo-600">Doctor subscription</p>
              <p className="mt-3">
                <span className="text-5xl font-bold tracking-tight text-slate-900">
                  ${org.priceUsd.toFixed(2)}
                </span>
                <span className="ml-2 text-slate-600">per month</span>
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Billed in US dollars. Cancel any time — you keep access until the end of the period
                you have paid for.
              </p>
              <Link
                href="/register"
                className="mt-6 block rounded-lg bg-indigo-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Create a doctor account
              </Link>
            </div>

            <ul className="space-y-3">
              {DOCTOR_FEATURES.map((f) => (
                <li key={f} className="flex gap-3 text-[15px] leading-7 text-slate-700">
                  <Check className="mt-1.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Safety */}
      <section className="border-t bg-slate-50 py-14">
        <div className="mx-auto flex max-w-5xl gap-4 px-6">
          <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
          <div>
            <h2 className="font-semibold text-slate-900">A note on safety</h2>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-slate-600">
              The assistant in {org.product} suggests which kind of doctor to see. It does not
              diagnose, treat, or give medical advice, and it is never a substitute for a qualified
              professional. In an emergency call your local emergency number — in Lebanon that is
              112 for police, 140 for the Red Cross ambulance and 125 for Civil Defence.
            </p>
          </div>
        </div>
      </section>

      {/* Contact + footer */}
      <footer id="contact" className="border-t py-12">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="font-semibold text-slate-900">Contact</h2>
          <p className="mt-2 text-[15px] leading-7 text-slate-600">
            {org.legalName ? <>{org.legalName}, {org.location}<br /></> : null}
            Email <a className="text-indigo-600 underline" href={`mailto:${org.email}`}>{org.email}</a>
            {org.phone ? <><br />Phone {org.phone}</> : null}
          </p>

          <nav className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/refund-policy" className="hover:text-slate-900">Refunds &amp; Cancellation</Link>
            <Link href="/login" className="hover:text-slate-900">Staff sign in</Link>
          </nav>
          <p className="mt-6 text-sm text-slate-500">
            © {new Date().getFullYear()} {org.legalName || org.product}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
