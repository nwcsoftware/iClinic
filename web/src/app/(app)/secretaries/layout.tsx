import { requireDoctor } from '../guard'

// Only a doctor manages their own secretaries. Checked on the server so the
// page cannot be reached by typing the address.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireDoctor()
  return <>{children}</>
}
