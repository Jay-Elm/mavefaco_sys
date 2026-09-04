'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ShoppingBag, ArrowRight, ClipboardList } from 'lucide-react'

export default function HomeHeroActions() {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <div className="mt-8 h-12" />

  if (isAuthenticated && user?.role === 'customer') {
    return (
      <div className="mt-8 flex flex-col sm:flex-row gap-3 hero-line-3">
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
        >
          <ShoppingBag size={18} />
          Browse produce
        </Link>
        <Link
          href="/customer/orders"
          className="inline-flex items-center justify-center gap-2 border border-white/25 text-white hover:bg-white/10 font-medium px-7 py-3.5 rounded-lg transition-colors"
        >
          My Orders <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="mt-8 flex flex-col sm:flex-row gap-3 hero-line-3">
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
        >
          <ShoppingBag size={18} />
          Browse produce
        </Link>
        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-2 border border-white/25 text-white hover:bg-white/10 font-medium px-7 py-3.5 rounded-lg transition-colors"
        >
          Sell your harvest <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  // Farmer/admin/manager: redirecting — just show browse button during the flash
  return (
    <div className="mt-8 hero-line-3">
      <Link
        href="/products"
        className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-lg transition-colors"
      >
        <ShoppingBag size={18} />
        Browse produce
      </Link>
    </div>
  )
}
