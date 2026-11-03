'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { refreshNavBadges } from '@/components/NavBadge'

const POLL_MS = 15_000

const LiveVersionContext = createContext(0)

/**
 * Keeps open pages current without a manual refresh.
 *
 * Every 15 seconds while the tab is visible (and straight away when the
 * viewer comes back to it), asks /api/live for a short fingerprint of what
 * this viewer can see: messages, notices, orders, listings, announcements,
 * site content. When it changes:
 *  - pages rendered on the server (home, shop, product pages) re-render in
 *    place via router.refresh(), keeping scroll position and inputs;
 *  - pages that load their own data re-fetch, because they list
 *    useLiveVersion() among their effect's dependencies;
 *  - sidebar badges re-count.
 */
export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  const router = useRouter()
  const [version, setVersion] = useState(0)
  const lastStamp = useRef<string | null>(null)

  useEffect(() => {
    if (loading) return
    lastStamp.current = null // a different viewer: start over
    let cancelled = false
    let inFlight = false

    async function check() {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const res = await fetch('/api/live', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' })
        if (!res.ok || cancelled) return
        const { stamp } = (await res.json()) as { stamp: string }
        if (lastStamp.current !== null && stamp !== lastStamp.current) {
          setVersion((v) => v + 1)
          router.refresh()
          refreshNavBadges()
        }
        lastStamp.current = stamp
      } catch {
        // Offline for a moment: try again on the next tick.
      } finally {
        inFlight = false
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [token, loading, router])

  return <LiveVersionContext.Provider value={version}>{children}</LiveVersionContext.Provider>
}

/**
 * A number that goes up whenever something this viewer can see changed.
 * Add it to the dependencies of the effect that loads a page's data, and the
 * page re-loads by itself.
 */
export function useLiveVersion(): number {
  return useContext(LiveVersionContext)
}
