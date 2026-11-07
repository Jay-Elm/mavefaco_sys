'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import SignalBadge from './SignalBadge'
import { otherUnits, type MarketData } from './marketTypes'

/**
 * Shown on the New Planting form once a crop is chosen: what that crop has
 * sold lately against what members already plan to harvest, so the
 * decision to plant gets the market signal at the moment it's made.
 */
export default function PlantingMarketHint({ token, cropTypeId }: { token: string | null; cropTypeId: string }) {
  const [data, setData] = useState<MarketData | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/market', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => !d.error && setData(d))
      .catch(() => {})
  }, [token])

  const row = data?.rows.find((r) => String(r.crop.id) === cropTypeId)
  if (!data || !row) return null
  const w = data.demandWeeks

  const advice: Record<string, string> = {
    'demand-above-supply': `Customers have been buying more ${row.crop.name} than members plan to harvest. A good crop to plant.`,
    balanced: `Planned harvests roughly match what customers have been buying.`,
    oversupply: `Members already plan more ${row.crop.name} than customers have been buying. Prices may fall if everyone harvests together.`,
    'no-recent-demand': `Little ${row.crop.name} has sold lately, but members still plan harvests.`,
    'other-units': `${row.crop.name} sells by the bundle or piece here, so its sales can't be set against planned kilos. Check how it has been selling below.`,
    'not-enough-data': `Not enough ${row.crop.name} sales yet to judge demand.`,
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-gray-700" aria-live="polite">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-soil">
        <TrendingUp size={15} className="text-blue-700" aria-hidden /> Market for {row.crop.name}
        <SignalBadge signal={row.signal} />
      </p>
      <p className="mt-1">{advice[row.signal]}</p>
      <ul className="mt-1.5 text-xs text-gray-600 space-y-0.5">
        <li>
          Sold in the last {w} weeks: {row.demand.kg > 0 ? `${row.demand.kg} kg` : 'none by the kilo'}
          {Object.keys(row.demand.other).length > 0 && `, ${otherUnits(row.demand.other)}`}
        </li>
        <li>Members plan to harvest in the next {w} weeks: {row.supply.kg > 0 ? `${row.supply.kg} kg` : 'none recorded'}</li>
        {row.pricePerKg !== null && <li>Average selling price lately: ₱{row.pricePerKg.toFixed(2)} per kg</li>}
      </ul>
      <Link href="/farmer/market" className="mt-1.5 inline-block text-xs font-medium text-paddy hover:underline">See all crops on the Market page</Link>
    </div>
  )
}
