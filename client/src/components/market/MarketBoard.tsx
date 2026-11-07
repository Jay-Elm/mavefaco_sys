'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight, Info, Loader2, Megaphone, RefreshCw, Search, Sprout, TrendingUp } from 'lucide-react'
import { CROP_CATEGORIES, byCategory } from '@/lib/cropCategories'
import { searchCrops } from '@/lib/cropKeywords'
import { useAuth } from '@/contexts/AuthContext'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import { ANNOUNCEMENT_DRAFT_KEY } from '@/components/AiReportPanel'
import SignalBadge from './SignalBadge'
import PriceTrend from './PriceTrend'
import { fmtDate, fmtMonth, lastMonths, otherUnits, type MarketData, type MarketRow } from './marketTypes'

/**
 * The Market page, for staff and farmers alike: alerts, crops worth
 * planting, and each crop's recent demand against planned harvests, with
 * its selling-price trend. Totals only; no farm or customer is named.
 */
export default function MarketBoard({ forStaff }: { forStaff: boolean }) {
  const { token } = useAuth()
  const live = useLiveVersion()
  const router = useRouter()
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState('')
  const [reload, setReload] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/market', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Could not load market signals'))
  }, [token, live, reload])

  async function syncPsa() {
    setSyncing(true)
    setSyncNote('')
    try {
      const res = await fetch('/api/admin/market/psa', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d) {
        setSyncNote(
          d?.error ??
            (res.status === 504
              ? 'The update ran out of time on the server. Try again in a minute.'
              : `Could not update PSA figures (server answered ${res.status}).`),
        )
        return
      }
      setSyncNote(d.errors?.length ? `Updated ${d.prices + d.production} figures; some PSA tables didn't answer (${d.errors[0]}).` : `Updated ${d.prices} prices and ${d.production} production figures.`)
      setReload((n) => n + 1)
    } catch {
      setSyncNote('Could not update PSA figures')
    } finally {
      setSyncing(false)
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data)
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )

  const byId = new Map(data.rows.map((r) => [r.crop.id, r]))
  const suggestions = data.suggestions.map((id) => byId.get(id)!).filter(Boolean)
  const months = lastMonths(data.today)
  const w = data.demandWeeks
  // By default, crops with sales, planned harvests or listings; "Show all"
  // (or a search) brings in every Bicol crop.
  const inCategory = data.rows.filter((r) => category === 'all' || r.crop.category === category)
  const active = inCategory.filter((r) => activity(r) > 0)
  const withRow = inCategory.map((r) => ({ ...r.crop, row: r }))
  let rows: MarketRow[]
  if (query.trim()) rows = searchCrops(query, withRow).map((x) => x.crop.row)
  else if (showAll) rows = byCategory(withRow).map((c) => c.row)
  else rows = [...active].sort((a, b) => activity(b) - activity(a) || a.crop.name.localeCompare(b.crop.name))

  function draftAdvisory() {
    const lines = data!.alerts.map((a) => `• ${a.message}`)
    const plant = suggestions.slice(0, 3).map((r) => (r.plantTodayHarvest ? `${r.crop.name} (harvest about ${fmtDate(r.plantTodayHarvest.from)}–${fmtDate(r.plantTodayHarvest.to)} if planted now)` : r.crop.name))
    const body = [
      `From the marketplace's sales over the last ${w} weeks and members' planned harvests for the next ${w}:`,
      '',
      ...lines,
      ...(plant.length ? ['', `Worth considering for your next planting: ${plant.join('; ')}.`] : []),
      '',
      'These figures are guidance from our own marketplace, not a forecast.',
    ].join('\n')
    try {
      sessionStorage.setItem(ANNOUNCEMENT_DRAFT_KEY, JSON.stringify({ title: 'Market update for members', body, type: 'advisory', audience: 'farmers' }))
    } catch {
      // Storage blocked: the page opens without the draft.
    }
    router.push('/dashboard/announcements')
  }

  return (
    <div className="space-y-6">
      <p className="flex items-start gap-2 text-sm text-gray-600 max-w-3xl">
        <Info size={16} className="shrink-0 mt-0.5 text-gray-500" />
        <span>
          Demand is what customers bought on this marketplace in the last {w} weeks (cancelled orders left out). Planned supply is what
          member farms expect to harvest in the next {w} weeks, from their recorded plantings. This is guidance from the cooperative&apos;s
          own sales, not a market forecast.
          {forStaff && data.unlinkedListings > 0 && (
            <> {data.unlinkedListings} live listing{data.unlinkedListings === 1 ? ' isn’t' : 's aren’t'} tied to a crop yet, so {data.unlinkedListings === 1 ? 'its' : 'their'} sales aren&apos;t counted.</>
          )}
        </span>
      </p>

      {/* Where the outside figures come from */}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>
          Albay and Bicol prices are PSA farmgate prices (what farmers are paid), from the {data.psa.source}
          {data.psa.latestMonth ? `, latest ${fmtMonth(data.psa.latestMonth)}` : ''}. PSA publishes about two months behind.
          {!data.psa.updatedAt && ' No PSA figures have been fetched yet.'}
        </span>
        {forStaff && (
          <button onClick={syncPsa} disabled={syncing} className="inline-flex items-center gap-1 font-medium text-paddy hover:underline disabled:opacity-50">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Updating…' : 'Update PSA figures now'}
          </button>
        )}
        {syncNote && <span role="status" className="text-gray-700">{syncNote}</span>}
      </p>

      {/* Alerts */}
      <section aria-labelledby="alerts-h">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 id="alerts-h" className="text-lg font-semibold text-soil">Market alerts</h2>
          {forStaff && data.alerts.length > 0 && (
            <button onClick={draftAdvisory} className="inline-flex items-center gap-1.5 text-sm font-medium text-paddy hover:underline">
              <Megaphone size={14} /> Draft an advisory for farmers
            </button>
          )}
        </div>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-gray-500">No alerts: no crop is selling well ahead of planned harvests, and no crop&apos;s demand is climbing fast.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.alerts.map((a) => (
              <li key={`${a.kind}-${a.cropTypeId}`} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${a.kind === 'low-supply' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
                {a.kind === 'low-supply' ? <AlertTriangle size={15} className="shrink-0 mt-0.5" /> : <TrendingUp size={15} className="shrink-0 mt-0.5" />}
                <span><strong className="font-semibold">{a.kind === 'low-supply' ? 'Low supply' : 'Rising demand'}: {a.crop}.</strong> {a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Crops worth planting */}
      <section aria-labelledby="plant-h">
        <h2 id="plant-h" className="text-lg font-semibold text-soil mb-2">{forStaff ? 'Crops to recommend planting' : 'Crops worth planting now'}</h2>
        {suggestions.length === 0 ? (
          <p className="text-sm text-gray-500">None right now: no crop&apos;s recent sales are ahead of what members plan to harvest.</p>
        ) : (
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((r, i) => (
              <li key={r.crop.id} className="rounded-lg border border-paddy/20 bg-white px-4 py-3 shadow-sm">
                <p className="flex items-center gap-2 font-semibold text-soil">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-shoot text-[11px] text-paddy-deep">{i + 1}</span>
                  <Sprout size={15} className="text-paddy" aria-hidden /> {r.crop.name}
                </p>
                <p className="mt-1 text-sm text-gray-700">
                  {r.demand.kg} kg sold in {w} weeks; {r.supply.kg} kg planned. Room for about <strong>{Math.round(r.gapKg)} kg</strong> more.
                </p>
                {r.plantTodayHarvest && (
                  <p className="mt-1 text-xs text-gray-500">
                    Planted today, it would be ready about {fmtDate(r.plantTodayHarvest.from)}–{fmtDate(r.plantTodayHarvest.to)} ({r.crop.daysToHarvestMin}–{r.crop.daysToHarvestMax} days, DA figure).
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Every crop */}
      <section aria-labelledby="crops-h">
        <h2 id="crops-h" className="text-lg font-semibold text-soil mb-2">Demand and planned supply by crop</h2>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any crop, e.g. talong" aria-label="Search crops"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-paddy" />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="all">All categories</option>
            {CROP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-paddy" />
            Show all {inCategory.length} Bicol crops
          </label>
          <span className="text-xs text-gray-500">{rows.length} shown{!showAll && !query.trim() ? ' (with sales, planned harvests or listings)' : ''}</span>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Crop</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Sold, last {w} wks</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Planned harvest, next {w} wks</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Signal</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Avg price here</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Albay farmgate (PSA)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => {
                  const isOpen = open === r.crop.id
                  return (
                    <React.Fragment key={r.crop.id}>
                      <tr
                        className={`cursor-pointer ${isOpen ? 'bg-shoot/40' : 'hover:bg-gray-50'}`}
                        onClick={() => setOpen(isOpen ? null : r.crop.id)}
                        aria-expanded={isOpen}
                      >
                        <td className="px-4 py-3 font-medium text-soil">
                          <span className="inline-flex items-center gap-1">
                            <ChevronRight size={14} aria-hidden className={`transition-transform ${isOpen ? 'rotate-90 text-paddy' : 'text-gray-400'}`} />
                            {r.crop.name}
                            {r.risingDemand && <TrendingUp size={13} className="text-blue-700" aria-label="demand rising" />}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {r.demand.kg > 0 ? `${r.demand.kg} kg` : r.demand.orders === 0 ? '—' : ''}
                          {Object.keys(r.demand.other).length > 0 && <span className="block text-xs text-gray-500">{otherUnits(r.demand.other)}</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {r.supply.kg > 0 ? `${r.supply.kg} kg` : '—'}
                          {r.supply.farms > 0 && <span className="block text-xs text-gray-500">{r.supply.farms} farm{r.supply.farms === 1 ? '' : 's'}</span>}
                        </td>
                        <td className="px-4 py-3"><SignalBadge signal={r.signal} /></td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{r.pricePerKg !== null ? `₱${r.pricePerKg.toFixed(2)}/kg` : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {r.psa.latest.albay ? (
                            <>₱{r.psa.latest.albay.pricePerKg.toFixed(2)}/kg<span className="block text-xs text-gray-500">{fmtMonth(r.psa.latest.albay.month)}</span></>
                          ) : '—'}
                        </td>
                      </tr>
                      {isOpen && <Detail row={r} months={months} w={w} />}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          The signal compares kilos only: crops sold by the bundle or piece show their sales but no supply comparison. &quot;Demand above
          supply&quot; means members plan less than 75% of recent sales; &quot;possible oversupply&quot;, more than 150%.
        </p>
      </section>
    </div>
  )
}

const activity = (r: MarketRow) => (r.demand.orders > 0 ? 4 : 0) + (r.supply.kg > 0 || r.supply.farms > 0 ? 2 : 0) + (r.listings > 0 ? 1 : 0)

function Detail({ row: r, months, w }: { row: MarketRow; months: string[]; w: number }) {
  return (
    <tr className="bg-shoot/40">
      <td colSpan={6} className="px-3 sm:px-6 pb-4 pt-1">
        {/* On a phone the table scrolls sideways; keep the detail in view. */}
        <div className="sticky left-3 max-w-[calc(100vw-4.5rem)] md:max-w-none grid gap-4 md:grid-cols-[3fr_2fr] rounded-lg bg-white/80 border border-paddy/15 p-4">
          <PriceTrend
            months={months}
            title={`${r.crop.name}: price per kg, last 12 months`}
            series={[
              { key: 'marketplace', label: 'This marketplace', short: 'Here', points: r.prices },
              { key: 'albay', label: 'Albay farmgate (PSA)', short: 'Albay', points: r.psa.prices.albay },
              { key: 'bicol', label: 'Bicol farmgate (PSA)', short: 'Bicol', points: r.psa.prices.bicol },
            ]}
          />
          <dl className="text-sm text-gray-700 space-y-2">
            <div>
              <dt className="text-xs font-semibold text-paddy-deep">Orders in the last {w} weeks</dt>
              <dd>{r.demand.orders}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-paddy-deep">If planted today</dt>
              <dd>{r.plantTodayHarvest ? `Ready about ${fmtDate(r.plantTodayHarvest.from)}–${fmtDate(r.plantTodayHarvest.to)}` : 'No typical growing time on record'}</dd>
            </div>
            {(r.psa.production.albay.length > 0 || r.psa.production.bicol.length > 0) && (
              <div>
                <dt className="text-xs font-semibold text-paddy-deep">Harvested, metric tons (PSA)</dt>
                <dd className="text-xs text-gray-600">
                  {(['albay', 'bicol'] as const).map((a) => {
                    const q = r.psa.production[a].at(-1)
                    return q ? (
                      <span key={a} className="block">
                        {a === 'albay' ? 'Albay' : 'Bicol region'}: {q.tonnes.toLocaleString('en-PH')} t in Q{q.quarter} {q.year}
                        {r.psa.production[a].length > 1 && `; before that ${r.psa.production[a].slice(0, -1).map((p) => `Q${p.quarter} ${p.year}: ${p.tonnes.toLocaleString('en-PH')} t`).join(', ')}`}
                      </span>
                    ) : null
                  })}
                </dd>
              </div>
            )}
            {r.crop.source && (
              <div>
                <dt className="text-xs font-semibold text-paddy-deep">Growing time source</dt>
                <dd className="text-xs text-gray-600">{r.crop.source}</dd>
              </div>
            )}
          </dl>
        </div>
      </td>
    </tr>
  )
}
