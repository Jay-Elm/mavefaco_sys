'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export default function HomeBottomCTAButtons() {
  const { isAuthenticated, user } = useAuth()
  const isCustomer = isAuthenticated && user?.role === 'customer'

  return (
    <div className="mt-8 flex flex-col sm:flex-row gap-3">
      {!isAuthenticated && <Link href="/register" className="btn btn-calamansi">Join as a farmer</Link>}
      {isCustomer && <Link href="/customer/orders" className="btn btn-calamansi">My Orders</Link>}
      <Link href="/products" className="btn btn-on-dark">Browse produce</Link>
    </div>
  )
}
