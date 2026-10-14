import RoleRedirect from '@/components/RoleRedirect'

// Customer orders, messages and profile are for customer accounts only.
const NOT_CUSTOMERS = ['admin', 'manager', 'farmer']

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RoleRedirect roles={NOT_CUSTOMERS} />
      {children}
    </>
  )
}
