import type { Signal } from '@/lib/market'

/** GET /api/market, as the pages receive it. */
export interface MarketRow {
  crop: { id: number; name: string; daysToHarvestMin: number; daysToHarvestMax: number; source?: string | null }
  demand: { kg: number; other: Record<string, number>; orders: number }
  supply: { kg: number; farms: number }
  signal: Signal
  risingDemand: boolean
  gapKg: number
  pricePerKg: number | null
  prices: { month: string; pricePerKg: number; kg: number }[]
  plantTodayHarvest: { from: string; to: string }
  /** PSA OpenSTAT figures for Albay and the Bicol region. */
  psa: {
    prices: Record<'albay' | 'bicol', { month: string; pricePerKg: number }[]>
    latest: Record<'albay' | 'bicol', { month: string; pricePerKg: number } | null>
    production: Record<'albay' | 'bicol', { year: number; quarter: number; tonnes: number }[]>
  }
}

export interface MarketAlertRow {
  cropTypeId: number
  crop: string
  kind: 'low-supply' | 'high-demand'
  message: string
}

export interface MarketData {
  today: string
  demandWeeks: number
  rows: MarketRow[]
  alerts: MarketAlertRow[]
  suggestions: number[]
  unlinkedListings: number
  psa: { source: string; latestMonth: string | null; updatedAt: string | null }
}

/** "June 2026" from "2026-06". */
export const fmtMonth = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "12 bundles, 3 pieces" for sales not sold by the kilo. */
export function otherUnits(other: Record<string, number>): string {
  return Object.entries(other)
    .map(([u, q]) => `${Math.round(q * 100) / 100} ${u}${q === 1 ? '' : u.endsWith('s') ? '' : 's'}`)
    .join(', ')
}

export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** The last 12 months as "YYYY-MM", oldest first. */
export function lastMonths(today: string, count = 12): string[] {
  const [y, m] = today.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1)).toISOString().slice(0, 7))
}
