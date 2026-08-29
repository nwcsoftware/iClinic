import { requireSecretaryRole } from '../guard'

// The schedule screen is the secretary's view of availability. A doctor manages
// theirs in the app, so they are sent back rather than shown a second one.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireSecretaryRole()
  return <>{children}</>
}
