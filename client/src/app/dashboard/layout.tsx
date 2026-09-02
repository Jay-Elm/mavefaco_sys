'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Tag,
  Package,
  ShoppingCart,
  ScrollText,
  BarChart2,
  Megaphone,
  Globe,
  Loader2,
} from 'lucide-react'

const ADMIN_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/categories', label: 'Categories', icon: Tag },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/dashboard/site', label: 'Site Content', icon: Globe },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart2 },
]

const MANAGER_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/users', label: 'Users', icon: Users },
  { href: '/dashboard/categories', label: 'Categories', icon: Tag },
  { href: '/dashboard/products', label: 'Products', icon: Package },
  { href: '/dashboard/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart2 },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (user?.role !== 'admin' && user?.role !== 'manager') {
      router.replace('/')
    }
  }, [loading, isAuthenticated, user, router])


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || (user?.role !== 'admin' && user?.role !== 'manager')) {
    return null
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar — scrolls independently if nav items overflow */}
      <aside className="w-56 shrink-0 bg-gray-900 text-gray-300 flex flex-col overflow-y-auto">
        <div className="px-4 py-5 border-b border-gray-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {user.role === 'admin' ? 'Admin' : 'Manager'} Panel
          </p>
          <p className="text-sm font-medium text-white mt-0.5 truncate">{user.name}</p>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {(user.role === 'admin' ? ADMIN_NAV : MANAGER_NAV).map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href + '/') || pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-green-700 text-white'
                    : 'hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-gray-700 text-xs text-gray-500">
          CoopMarket v0.1
        </div>
      </aside>

      {/* Main content — scrolls independently */}
      <div className="flex-1 bg-gray-50 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
