'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import {
  ShoppingBag, LogIn, LogOut, UserPlus, User, Leaf,
  LayoutDashboard, ShoppingCart, ClipboardList, UserCircle, Info, MessageCircle,
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
      className={`sticky top-0 z-50 h-16 flex items-center bg-green-800 text-white transition-all duration-200 ${
        scrolled ? 'shadow-xl shadow-green-900/30' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <Leaf size={18} className="text-green-300" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight">
            Coop<span className="text-orange-400">Market</span>
          </span>
        </Link>

        <div className="flex items-center gap-0.5">
          <Link
            href="/products"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <ShoppingBag size={15} />
            <span>Products</span>
          </Link>

          <Link
            href="/about"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <Info size={15} />
            <span>About</span>
          </Link>

          <Link
            href="/cart"
            className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <ShoppingCart size={15} />
            <span>Cart</span>
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <LayoutDashboard size={15} />
                  <span>Dashboard</span>
                </Link>
              )}
              {user?.role === 'farmer' && (
                <Link
                  href="/farmer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                >
                  <LayoutDashboard size={15} />
                  <span>My Farm</span>
                </Link>
              )}
              {user?.role === 'customer' && (
                <>
                  <Link
                    href="/customer/messages"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    <MessageCircle size={15} />
                    <span>Messages</span>
                  </Link>
                  <Link
                    href="/customer/orders"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    <ClipboardList size={15} />
                    <span>My Orders</span>
                  </Link>
                  <Link
                    href="/customer/profile"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                  >
                    <UserCircle size={15} />
                    <span>Profile</span>
                  </Link>
                </>
              )}

              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 ml-1 rounded-lg bg-white/10 text-sm text-green-200">
                <User size={14} />
                <span className="max-w-[100px] truncate">{user?.name}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium ml-0.5"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
              >
                <LogIn size={15} />
                <span>Login</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors text-sm font-semibold ml-1"
              >
                <UserPlus size={15} />
                <span>Register</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
