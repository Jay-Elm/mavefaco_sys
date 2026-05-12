'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import {
  ShoppingBag, LogIn, LogOut, UserPlus, User, Leaf,
  LayoutDashboard, ShoppingCart, ClipboardList, UserCircle,
} from 'lucide-react'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { totalItems } = useCart()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleLogout() {
    logout()
    router.push('/')
    router.refresh()
  }

  return (
    <nav
      className={`sticky top-0 z-50 h-14 flex items-center bg-green-700 text-white transition-shadow duration-200 ${
        scrolled ? 'shadow-xl' : 'shadow-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold hover:opacity-90">
          <Leaf size={22} />
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

          <Link
            href="/cart"
            className="relative flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
          >
            <ShoppingCart size={16} />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
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
              {user?.role === 'customer' && (
                <>
                  <Link
                    href="/customer/orders"
                    className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    <ClipboardList size={16} />
                    <span>My Orders</span>
                  </Link>
                  <Link
                    href="/customer/profile"
                    className="flex items-center gap-1 px-3 py-2 rounded hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    <UserCircle size={16} />
                    <span>Profile</span>
                  </Link>
                </>
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
