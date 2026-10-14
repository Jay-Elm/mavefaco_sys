import { redirectRoles } from '@/lib/serverSession'

// Customer orders, messages and profile are for customer accounts only.
export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  await redirectRoles(['admin', 'manager', 'farmer'])
  return children
}
