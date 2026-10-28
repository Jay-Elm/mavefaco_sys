'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import LogoutConfirmModal from '@/components/LogoutConfirmModal'
import {
  ShoppingBag, LogIn, LogOut, Sprout, ChevronDown,
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // The account menu closes on a click outside it or on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // The farmer/admin/manager dashboards have their own persistent chrome
  // (sidebar, mobile top bar) — hiding this bar on scroll there would fight
  // with that layout instead of freeing up view space.
  const isDashboardStyle = pathname.startsWith('/dashboard') || pathname.startsWith('/farmer')
  const [navHidden, setNavHidden] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    if (isDashboardStyle) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNavHidden(false)
      return
    }
    lastScrollY.current = window.scrollY
    function onScroll() {
      const y = window.scrollY
      setScrolled(y > 8)
      // Don't hide the bar for the open mobile menu — it anchors to this
      // nav's height, so pulling the nav away mid-interaction looks broken.
      if (!mobileOpen) {
        setNavHidden(y > lastScrollY.current && y > 80)
      }
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isDashboardStyle, mobileOpen])

  // Close mobile menu on route change. Adjusted during render rather
  // than in an effect so the old open state never paints on the new page.
  const [prevPathname, setPrevPathname] = useState(pathname)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setMobileOpen(false)
    setMenuOpen(false)
  }

  function handleLogout() {
    setShowLogoutConfirm(false)
    logout()
    router.push('/')
    router.refresh()
  }

  // Shopping is for customers (and guests, who sign in as customers to buy).
  // Staff don't browse the storefront at all; farmers browse but don't buy.
  const isStaff = user?.role === 'admin' || user?.role === 'manager'
  const canShop = !isAuthenticated || user?.role === 'customer'

  const linkCls = 'flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium'
  const mobileLinkCls = 'flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-white/10 transition-colors text-base font-medium w-full'

  // Everything about the signed-in person's own account, in one menu.
  const accountLinks =
    user?.role === 'customer'
      ? [
          { href: '/customer/orders', label: 'My Orders', icon: ClipboardList },
          { href: '/customer/messages', label: 'Messages', icon: MessageCircle },
          { href: '/customer/profile', label: 'Profile', icon: UserCircle },
        ]
      : []
  const portal = isStaff
    ? { href: '/dashboard', label: 'Dashboard' }
    : user?.role === 'farmer'
      ? { href: '/farmer', label: 'My farm' }
      : null

  const cartLabel = `Cart, ${totalItems} item${totalItems === 1 ? '' : 's'}`
  const cartBadge = totalItems > 0 && (
    <span className="absolute -top-0.5 -right-0.5 bg-calamansi text-soil text-[11px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center leading-none tabular">
      {totalItems > 9 ? '9+' : totalItems}
    </span>
  )

  return (
    <>
      <nav
        className={`sticky top-0 z-50 h-16 flex items-center bg-soil text-white transition-[transform,box-shadow] duration-300 ${
          scrolled ? 'shadow-lg shadow-black/20' : ''
        } ${navHidden ? '-translate-y-full' : 'translate-y-0'}`}
      >
        {/* Full width over the dashboards, so the logo lines up with their sidebar. */}
        <div className={`${isDashboardStyle ? 'px-5' : 'max-w-[1200px] mx-auto px-6'} w-full flex items-center justify-between gap-6`}>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0" aria-label="MaVeFaCo home">
            <Sprout size={20} className="text-calamansi" aria-hidden="true" />
            <span className="font-display text-2xl font-extrabold leading-none">MaVeFaCo</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1 flex-1">
            {!isStaff && <Link href="/products" className={linkCls}>Products</Link>}
            <Link href="/about" className={linkCls}>About</Link>
            {portal && <Link href={portal.href} className={linkCls}>{portal.label}</Link>}

            <div className="ml-auto flex items-center gap-1">
              {canShop && (
                <Link href="/cart" className="relative p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label={cartLabel}>
                  <ShoppingCart size={20} aria-hidden="true" />
                  {cartBadge}
                </Link>
              )}

              {isAuthenticated ? (
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    className={`${linkCls} ml-1`}
                  >
                    <UserCircle size={18} aria-hidden="true" />
                    <span className="max-w-[140px] truncate">{user?.name}</span>
                    <ChevronDown size={15} aria-hidden="true" className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {menuOpen && (
                    <div role="menu" className="absolute right-0 top-full mt-2 w-56 bg-white text-soil rounded-card shadow-card border border-gray-200 py-1.5">
                      {accountLinks.map(({ href, label, icon: Icon }) => (
                        <Link key={href} href={href} role="menuitem" className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-field">
                          <Icon size={16} className="text-gray-500" aria-hidden="true" />{label}
                        </Link>
                      ))}
                      {accountLinks.length > 0 && <div className="my-1.5 border-t border-gray-100" />}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setMenuOpen(false); setShowLogoutConfirm(true) }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-field text-left"
                      >
                        <LogOut size={16} className="text-gray-500" aria-hidden="true" />Log out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/login" className={linkCls}>Log in</Link>
                  <Link href="/register" className="btn btn-calamansi ml-1 py-2 px-4 text-sm">Register</Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile: cart (shoppers only) + menu */}
          <div className="flex lg:hidden items-center gap-1">
            {canShop && (
              <Link href="/cart" className="relative p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label={cartLabel}>
                <ShoppingCart size={20} aria-hidden="true" />
                {cartBadge}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed top-16 left-0 right-0 bottom-0 bg-soil text-white z-40 overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {!isStaff && <Link href="/products" className={mobileLinkCls}><ShoppingBag size={18} />Products</Link>}
            <Link href="/about" className={mobileLinkCls}><Info size={18} />About</Link>
            {portal && <Link href={portal.href} className={mobileLinkCls}><LayoutDashboard size={18} />{portal.label}</Link>}

            {isAuthenticated ? (
              <>
                <div className="border-t border-white/10 my-3" />
                <p className="px-4 pb-1 text-sm text-white/60 truncate">Signed in as {user?.name}</p>
                {accountLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className={mobileLinkCls}><Icon size={18} />{label}</Link>
                ))}
                <button onClick={() => setShowLogoutConfirm(true)} className={mobileLinkCls}>
                  <LogOut size={18} />Log out
                </button>
              </>
            ) : (
              <>
                <div className="border-t border-white/10 my-3" />
                <Link href="/login" className={mobileLinkCls}><LogIn size={18} />Log in</Link>
                <Link href="/register" className="btn btn-calamansi w-full mt-2">Register</Link>
              </>
            )}
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <LogoutConfirmModal
          role={user?.role}
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </>
  )
}
