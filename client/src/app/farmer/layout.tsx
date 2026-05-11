'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, LayoutDashboard, Package, ShoppingCart, User, Leaf } from 'lucide-react'

const NAV = [
  { href: '/farmer', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/farmer/products', label: 'My Products', icon: Package },
  { href: '/farmer/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/farmer/profile', label: 'Profile', icon: User },
]

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) { router.replace('/login'); return }
    if (user?.role !== 'farmer') { router.replace('/'); return }
  }, [loading, isAuthenticated, user, router])

  if (loading || !isAuthenticated || user?.role !== 'farmer') {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="px-5 py-4 flex items-center gap-2 border-b border-gray-700">
          <Leaf size={18} className="text-green-400" />
          <span className="font-semibold text-sm">Farmer Portal</span>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-green-700 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 truncate">{user.name}</p>
          <button
            onClick={() => { logout(); router.push('/') }}
            className="mt-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
