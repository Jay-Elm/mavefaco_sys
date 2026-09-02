'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import {
  ShoppingBag, LogIn, LogOut, UserPlus, User, Leaf,
  LayoutDashboard, ShoppingCart, ClipboardList, UserCircle,
  Info, MessageCircle, Menu, X,
} from 'lucide-react'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()
  const { totalItems } = useCart()
  const router = useRouter()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  function handleLogout() {
    logout()
    router.push('/')
    router.refresh()
  }

  const linkCls = 'flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium'
  const mobileLinkCls = 'flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 transition-colors text-base font-medium w-full'

  return (
    <>
      <nav
        className={`sticky top-0 z-50 h-16 flex items-center bg-[#1B3A2D] text-white transition-shadow duration-200 ${
          scrolled ? 'shadow-lg shadow-black/20' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
            <div className="w-7 h-7 bg-white/10 rounded-md flex items-center justify-center">
              <Leaf size={16} className="text-green-300" />
            </div>
            <span className="font-serif text-xl font-bold tracking-tight">CoopMarket</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            <Link href="/products" className={linkCls}>
              <ShoppingBag size={15} /><span>Products</span>
            </Link>
            <Link href="/about" className={linkCls}>
              <Info size={15} /><span>About</span>
            </Link>
            <Link href="/cart" className={`relative ${linkCls}`}>
              <ShoppingCart size={15} /><span>Cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>

            {isAuthenticated ? (
              <>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <Link href="/dashboard" className={linkCls}><LayoutDashboard size={15} /><span>Dashboard</span></Link>
                )}
                {user?.role === 'farmer' && (
                  <Link href="/farmer" className={linkCls}><LayoutDashboard size={15} /><span>My Farm</span></Link>
                )}
                {user?.role === 'customer' && (
                  <>
                    <Link href="/customer/messages" className={linkCls}><MessageCircle size={15} /><span>Messages</span></Link>
                    <Link href="/customer/orders" className={linkCls}><ClipboardList size={15} /><span>My Orders</span></Link>
                    <Link href="/customer/profile" className={linkCls}><UserCircle size={15} /><span>Profile</span></Link>
                  </>
                )}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 ml-1 rounded-lg bg-white/10 text-sm text-green-200">
                  <User size={14} />
                  <span className="max-w-[100px] truncate">{user?.name}</span>
                </div>
                <button onClick={handleLogout} className={`ml-0.5 ${linkCls}`}>
                  <LogOut size={15} /><span>Logout</span>
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={linkCls}><LogIn size={15} /><span>Login</span></Link>
                <Link href="/register" className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors text-sm font-semibold ml-1">
                  <UserPlus size={15} /><span>Register</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile: cart badge + hamburger */}
          <div className="flex lg:hidden items-center gap-2">
            <Link href="/cart" className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
              <ShoppingCart size={20} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed top-16 left-0 right-0 bottom-0 bg-[#1B3A2D] z-40 overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            <Link href="/products" className={mobileLinkCls}><ShoppingBag size={18} />Products</Link>
            <Link href="/about" className={mobileLinkCls}><Info size={18} />About</Link>

            {isAuthenticated ? (
              <>
                <div className="border-t border-white/10 my-3" />
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <Link href="/dashboard" className={mobileLinkCls}><LayoutDashboard size={18} />Dashboard</Link>
                )}
                {user?.role === 'farmer' && (
                  <Link href="/farmer" className={mobileLinkCls}><LayoutDashboard size={18} />My Farm</Link>
                )}
                {user?.role === 'customer' && (
                  <>
                    <Link href="/customer/messages" className={mobileLinkCls}><MessageCircle size={18} />Messages</Link>
                    <Link href="/customer/orders" className={mobileLinkCls}><ClipboardList size={18} />My Orders</Link>
                    <Link href="/customer/profile" className={mobileLinkCls}><UserCircle size={18} />Profile</Link>
                  </>
                )}
                <div className="border-t border-white/10 my-3" />
                <div className="flex items-center gap-3 px-4 py-3 text-green-300 text-sm">
                  <User size={16} />
                  <span className="truncate">{user?.name}</span>
                </div>
                <button onClick={handleLogout} className={`${mobileLinkCls} text-red-300`}>
                  <LogOut size={18} />Logout
                </button>
              </>
            ) : (
              <>
                <div className="border-t border-white/10 my-3" />
                <Link href="/login" className={mobileLinkCls}><LogIn size={18} />Login</Link>
                <Link href="/register" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 transition-colors text-base font-semibold w-full">
                  <UserPlus size={18} />Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
