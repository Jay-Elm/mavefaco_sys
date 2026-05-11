'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ShoppingBag, LogIn, LogOut, UserPlus, User, Leaf, LayoutDashboard } from 'lucide-react'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const router = useRouter()

  function handleLogout() {
    logout()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-green-700 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:opacity-90">
          <Leaf size={24} />
          <span>CoopMarket</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            href="/products"
            className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
          >
            <ShoppingBag size={16} />
            <span>Products</span>
          </Link>

          {isAuthenticated ? (
            <>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  <LayoutDashboard size={16} />
                  <span>Dashboard</span>
                </Link>
              )}
              {user?.role === 'farmer' && (
                <Link
                  href="/farmer"
                  className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  <LayoutDashboard size={16} />
                  <span>My Farm</span>
                </Link>
              )}
              <span className="hidden sm:flex items-center gap-1 px-3 py-2 text-sm text-green-200">
                <User size={16} />
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
              >
                <LogIn size={16} />
                <span>Login</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 rounded transition-colors text-sm font-medium ml-1"
              >
                <UserPlus size={16} />
                <span>Register</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
