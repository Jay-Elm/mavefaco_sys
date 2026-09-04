'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ShoppingBag, ArrowRight, ClipboardList } from 'lucide-react'

export default function HomeBottomCTAButtons() {
  const { isAuthenticated, user } = useAuth()
  const isCustomer = isAuthenticated && user?.role === 'customer'

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {!isAuthenticated && (
        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
        >
          Join as a farmer <ArrowRight size={16} />
        </Link>
      )}
      {isCustomer && (
        <Link
          href="/customer/orders"
          className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
        >
          <ClipboardList size={16} />
          My Orders
        </Link>
      )}
      <Link
        href="/products"
        className="inline-flex items-center justify-center gap-2 border border-white/25 text-white hover:bg-white/10 font-medium px-7 py-3.5 rounded-lg transition-colors"
      >
        <ShoppingBag size={16} />
        Browse products
      </Link>
    </div>
  )
}
