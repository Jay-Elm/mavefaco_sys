'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, TrendingUp } from 'lucide-react'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import type { MarketAlertRow } from './marketTypes'

const SHOWN = 3

/** The farmer overview's market alerts: shortages and fast-rising demand. Hidden when there are none. */
export default function MarketAlertsCard({ token }: { token: string | null }) {
  const live = useLiveVersion()
  const [alerts, setAlerts] = useState<MarketAlertRow[]>([])

  useEffect(() => {
    if (!token) return
    fetch('/api/market', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d.alerts) && setAlerts(d.alerts))
      .catch(() => {})
  }, [token, live])

  if (alerts.length === 0) return null
  return (
    <section aria-labelledby="market-alerts-h" className="mb-8 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 id="market-alerts-h" className="flex items-center gap-2 font-semibold text-soil"><TrendingUp size={16} className="text-blue-700" aria-hidden /> Market alerts</h2>
        <Link href="/farmer/market" className="text-sm font-medium text-paddy hover:underline">Open Market</Link>
      </div>
      <ul className="space-y-1.5 text-sm text-gray-700">
        {alerts.slice(0, SHOWN).map((a) => (
          <li key={`${a.kind}-${a.cropTypeId}`} className="flex items-start gap-2">
            {a.kind === 'low-supply' ? <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-700" aria-hidden /> : <TrendingUp size={14} className="shrink-0 mt-0.5 text-blue-700" aria-hidden />}
            <span><strong className="font-semibold">{a.kind === 'low-supply' ? 'Low supply' : 'Rising demand'}: {a.crop}.</strong> {a.message}</span>
          </li>
        ))}
      </ul>
      {alerts.length > SHOWN && <p className="mt-1.5 text-xs text-gray-500">{alerts.length - SHOWN} more on the Market page.</p>}
    </section>
  )
}
