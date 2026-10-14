import { redirectRoles } from '@/lib/serverSession'

// Only customers (and guests, who sign in as customers to check out) shop.
export default async function CartLayout({ children }: { children: React.ReactNode }) {
  await redirectRoles(['admin', 'manager', 'farmer'])
  return children
}
