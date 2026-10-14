'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const REFRESH_EVENT = 'nav-badges:refresh'
const POLL_MS = 30_000

/**
 * Ask the sidebar to re-check its badges now, e.g. right after marking
 * notices read or accepting an order, instead of waiting for the next poll.
 */
export function refreshNavBadges() {
  window.dispatchEvent(new Event(REFRESH_EVENT))
}

/** Counts from /api/nav-badges, keyed by sidebar path; refreshed on navigation, on demand and every 30s. */
export function useNavBadges(): Record<string, number> {
  const { token, isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    const load = () =>
      fetch('/api/nav-badges', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && !cancelled) setBadges(d) })
        .catch(() => {})

    load()
    const interval = setInterval(load, POLL_MS)
    window.addEventListener(REFRESH_EVENT, load)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener(REFRESH_EVENT, load)
    }
  }, [isAuthenticated, token, pathname])

  return badges
}

/** Red count badge beside a sidebar link; renders nothing at zero. */
export function NavBadge({ count }: { count: number | undefined }) {
  if (!count) return null
  return (
    <span
      className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold leading-5 text-center"
      aria-label={`${count} new`}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

/** Small red dot for the mobile menu button when any sidebar link has a badge. */
export function MenuDot({ badges }: { badges: Record<string, number> }) {
  if (!Object.values(badges).some((n) => n > 0)) return null
  return <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" aria-label="New activity" />
}
