import { requireNotSecretary } from '../guard'

// Medical and commercial records. A secretary is sent back here, on the server,
// so the page never renders and its data is never fetched.
export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireNotSecretary()
  return <>{children}</>
}
