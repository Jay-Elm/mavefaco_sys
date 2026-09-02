'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, LayoutDashboard, Package, ShoppingCart, User, Leaf, Sprout, MessageCircle, Menu } from 'lucide-react'

const NAV = [
  { href: '/farmer', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/farmer/products', label: 'My Products', icon: Package },
  { href: '/farmer/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/farmer/crops', label: 'Crop Monitor', icon: Sprout },
  { href: '/farmer/messages', label: 'Messages', icon: MessageCircle },
  { href: '/farmer/profile', label: 'Profile', icon: User },
]

export default function FarmerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [pathname])

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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-20"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          w-56 bg-gray-900 text-white flex flex-col overflow-y-auto shrink-0
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
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
                  active ? 'bg-green-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-semibold text-gray-700">Farmer Portal</span>
        </div>

        {children}
      </main>
    </div>
  )
}
