'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function HomeHeroActions() {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <div className="mt-8 h-12" />

  // Farmers and staff are redirected away from this page; during that
  // moment only the browse button shows.
  const second =
    isAuthenticated && user?.role === 'customer'
      ? { href: '/customer/orders', label: 'My Orders' }
      : !isAuthenticated
        ? { href: '/register', label: 'Sell your harvest' }
        : null

  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-3">
      <Link href="/products" className="btn btn-calamansi">Browse produce</Link>
      {second && <Link href={second.href} className="btn btn-on-dark">{second.label}</Link>}
    </div>
  )
}
