import RoleRedirect from '@/components/RoleRedirect'

// Only customers (and guests, who sign in as customers to check out) shop.
const NON_SHOPPERS = ['admin', 'manager', 'farmer']

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleRedirect roles={NON_SHOPPERS} />
      {children}
    </>
  )
}
