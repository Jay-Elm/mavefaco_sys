'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { refreshNavBadges } from '@/components/NavBadge'

/** How often to check when instant signals aren't available. */
const POLL_MS = 15_000
/** With instant signals working, the poll is only a safety net. */
const BACKUP_POLL_MS = 60_000
/** Signals that arrive closer together than this share one check. */
const MIN_SIGNAL_GAP_MS = 2_000

interface RealtimeConfig { url: string; key: string; topic: string }

const LiveVersionContext = createContext(0)

/**
 * Keeps open pages current without a manual refresh.
 *
 * Asks /api/live for a short fingerprint of what this viewer can see
 * (messages, notices, orders, listings, announcements, site content) and,
 * when it changes:
 *  - pages rendered on the server (home, shop, product pages) re-render in
 *    place via router.refresh(), keeping scroll position and inputs;
 *  - pages that load their own data re-fetch, because they list
 *    useLiveVersion() among their effect's dependencies;
 *  - sidebar badges re-count.
 *
 * When to ask: straight away whenever the server signals that something
 * was saved (Supabase Realtime, see src/lib/liveSignal.ts), whenever the
 * viewer comes back to the tab, and on a timer as a backup: every 15 s
 * without signals, every 60 s with them.
 */
export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  const router = useRouter()
  const [version, setVersion] = useState(0)
  const [realtime, setRealtime] = useState<RealtimeConfig | null>(null)
  const lastStamp = useRef<string | null>(null)
  const lastCheck = useRef(0)
  const connected = useRef(false)
  const checkRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (loading) return
    lastStamp.current = null // a different viewer: start over
    let cancelled = false
    let inFlight = false
    let again = false

    async function check() {
      if (document.visibilityState !== 'visible') return
      // A check already running may have started before the latest change.
      if (inFlight) { again = true; return }
      inFlight = true
      lastCheck.current = Date.now()
      try {
        const res = await fetch('/api/live', { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { stamp: string; realtime?: RealtimeConfig | null }
        if (lastStamp.current !== null && data.stamp !== lastStamp.current) {
          setVersion((v) => v + 1)
          router.refresh()
          refreshNavBadges()
        }
        lastStamp.current = data.stamp
        // Same values give the same string, so the socket isn't re-opened.
        setRealtime((prev) => (JSON.stringify(prev) === JSON.stringify(data.realtime ?? null) ? prev : data.realtime ?? null))
      } catch {
        // Offline for a moment: try again on the next tick.
      } finally {
        inFlight = false
        if (again && !cancelled) { again = false; void check() }
      }
    }
    checkRef.current = () => void check()

    check()
    const interval = setInterval(() => {
      if (connected.current && Date.now() - lastCheck.current < BACKUP_POLL_MS) return
      check()
    }, POLL_MS)
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

  // Instant signals. Anyone could send a message on this channel, so a
  // signal only ever triggers the normal check, and at most one per
  // couple of seconds.
  useEffect(() => {
    if (!realtime) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let client: import('@supabase/realtime-js').RealtimeClient | null = null

    function onSignal() {
      if (timer) return
      // A short random wait spreads out the checks from every open page.
      const wait = Math.max(0, lastCheck.current + MIN_SIGNAL_GAP_MS - Date.now()) + 200 + Math.random() * 600
      timer = setTimeout(() => { timer = null; checkRef.current() }, wait)
    }

    import('@supabase/realtime-js').then(({ RealtimeClient }) => {
      if (disposed) return
      client = new RealtimeClient(`${realtime.url}/realtime/v1`, { params: { apikey: realtime.key } })
      client
        .channel(realtime.topic)
        .on('broadcast', { event: 'change' }, onSignal)
        .subscribe((status) => {
          const was = connected.current
          connected.current = status === 'SUBSCRIBED'
          // Back after a drop: catch up on anything missed meanwhile.
          if (connected.current && !was) checkRef.current()
        })
    }).catch(() => {
      // No signals: the poll carries on at the normal pace.
    })

    return () => {
      disposed = true
      connected.current = false
      if (timer) clearTimeout(timer)
      if (client) { void client.removeAllChannels(); void client.disconnect() }
    }
  }, [realtime])

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
