import Link from 'next/link'
import { org, legalReady, missingLegalFields, LAST_UPDATED } from '@/lib/legal'

// Shared shell for the three policy pages. Public: payment providers and
// patients both need to read these without an account.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            {org.product}
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        {!legalReady() ? (
          <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Not ready to submit to a payment provider yet.</p>
            <p className="mt-1">
              Set {missingLegalFields().join(', ')} in your environment. Providers check that a real
              name and contact are published here before approving a merchant account.
            </p>
          </div>
        ) : null}

        <article
          className="
            [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-slate-900
            [&_h2]:mt-9 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900
            [&_p]:mt-3 [&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-slate-700
            [&_li]:mt-2 [&_li]:text-[15px] [&_li]:leading-7 [&_li]:text-slate-700
            [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5
            [&_strong]:font-semibold [&_strong]:text-slate-900
            [&_a]:font-medium [&_a]:text-indigo-600 [&_a]:underline
          "
        >
          {children}
        </article>

        <p className="mt-12 border-t pt-6 text-sm text-slate-500">
          Last updated {LAST_UPDATED}. Questions? Email{' '}
          <a className="text-indigo-600 underline" href={`mailto:${org.email}`}>{org.email}</a>.
        </p>

        <nav className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          <Link href="/terms" className="hover:text-slate-900">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-slate-900">Privacy Policy</Link>
          <Link href="/refund-policy" className="hover:text-slate-900">Refunds &amp; Cancellation</Link>
        </nav>
      </main>
    </div>
  )
}
