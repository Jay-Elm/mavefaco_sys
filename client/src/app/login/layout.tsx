import { redirectRoles } from '@/lib/serverSession'

// Already signed in: go straight to your own home instead of seeing this form.
export default async function SignedOutOnlyLayout({ children }: { children: React.ReactNode }) {
  await redirectRoles(['admin', 'manager', 'farmer', 'customer'])
  return children
}
