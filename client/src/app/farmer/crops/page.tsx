'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { AlertTriangle, Bug, ChevronRight, Loader2, Plus, Sprout, Wheat } from 'lucide-react'
import { addDays, todayPH } from '@/lib/planting'
import { LOG_TYPES, STATUS_STYLES, fmtDate, fmtKg, fmtWindow, plantingBadge, type Planting } from '@/components/cropDisplay'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import ListToolbar from '@/components/ListToolbar'

type Row = Planting & {
  _count: { logs: number }
  latestProblem: { id: number; type: string; note: string; observedOn: string } | null
}

type Show = 'all' | 'growing' | 'ready' | 'overdue' | 'problem' | 'harvested' | 'failed'
type Sort = 'harvest' | 'planted-desc' | 'planted-asc' | 'name'

export default function CropsPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const [plantings, setPlantings] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [show, setShow] = useState<Show>('all')
  const [crop, setCrop] = useState('')
  const [sort, setSort] = useState<Sort>('harvest')

  useEffect(() => {
    if (!token) return
    fetch('/api/farmer/plantings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setPlantings(d)))
      .catch(() => setError('Failed to load your crops'))
      .finally(() => setLoading(false))
  }, [token, live])

  const cropNames = useMemo(() => [...new Set(plantings.map((p) => p.cropType.name))].sort(), [plantings])

  const { growing, history, attention } = useMemo(() => {
    const twoWeeksAgo = addDays(todayPH(), -14)
    const q = search.trim().toLowerCase()
    const hasProblem = (p: Row) => !!p.latestProblem && p.latestProblem.observedOn >= twoWeeksAgo
    const matches = (p: Row) =>
      (!q || p.cropType.name.toLowerCase().includes(q) || (p.product?.name.toLowerCase().includes(q) ?? false)) &&
      (!crop || p.cropType.name === crop) &&
      (show === 'all' ||
        (show === 'growing' && p.status === 'growing') ||
        (show === 'ready' && p.status === 'growing' && p.attention === 'harvest-now') ||
        (show === 'overdue' && p.status === 'growing' && p.attention === 'overdue') ||
        (show === 'problem' && p.status === 'growing' && hasProblem(p)) ||
        (show === 'harvested' && p.status === 'harvested') ||
        (show === 'failed' && p.status === 'failed'))
    const order = (a: Row, b: Row) => {
      switch (sort) {
        case 'planted-desc': return b.plantedOn.localeCompare(a.plantedOn)
        case 'planted-asc': return a.plantedOn.localeCompare(b.plantedOn)
        case 'name': return a.cropType.name.localeCompare(b.cropType.name)
        // Soonest harvest first while growing; most recent first for past seasons.
        default: return a.status === 'growing' ? a.harvestStart.localeCompare(b.harvestStart) : (b.harvestedOn ?? b.plantedOn).localeCompare(a.harvestedOn ?? a.plantedOn)
      }
    }
    const growing = plantings.filter((p) => p.status === 'growing' && matches(p))
    return {
      growing: [...growing].sort(order),
      history: plantings.filter((p) => p.status !== 'growing' && matches(p)).sort(order),
      attention: growing.flatMap((p) => {
        const items: { key: string; planting: Row; tone: 'red' | 'amber'; icon: typeof Bug; title: string; detail: string }[] = []
        if (p.attention === 'overdue')
          items.push({ key: `o${p.id}`, planting: p, tone: 'red', icon: AlertTriangle, title: 'Harvest window has passed',
            detail: `Expected by ${fmtDate(p.harvestEnd)}. Record the harvest, or mark it failed.` })
        else if (p.attention === 'harvest-now')
          items.push({ key: `h${p.id}`, planting: p, tone: 'amber', icon: Wheat, title: 'Ready to harvest',
            detail: `Harvest window ${fmtWindow(p.harvestStart, p.harvestEnd)}.` })
        const log = p.latestProblem
        if (log && log.observedOn >= twoWeeksAgo)
          items.push({ key: `l${p.id}`, planting: p, tone: 'red', icon: Bug,
            title: `${LOG_TYPES.find((t) => t.value === log.type)?.label ?? 'Problem'} reported`,
            detail: `${fmtDate(log.observedOn)}: ${log.note}` })
        return items
      }),
    }
  }, [plantings, search, show, crop, sort])
  const shownCount = growing.length + history.length
  const filtered = search.trim() !== '' || show !== 'all' || crop !== ''

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Sprout size={22} className="text-paddy" />
        <h1 className="text-2xl font-bold text-soil">Crop Monitor</h1>
        <Link href="/farmer/advisory" className="ml-auto text-sm text-paddy hover:underline">
          Community advisory
        </Link>
        <Link
          href="/farmer/crops/new"
          className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Record planting
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {plantings.length === 0 && !error ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm text-center py-16 px-6">
          <Sprout size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">No plantings yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Record what you plant and when. The Crop Monitor works out each crop&apos;s harvest window
            and tells you when it&apos;s time to harvest.
          </p>
          <Link href="/farmer/crops/new" className="mt-4 inline-block text-paddy text-sm font-medium hover:underline">
            Record your first planting →
          </Link>
        </div>
      ) : (
        <>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            placeholder="Search crops or listings"
            filters={[
              { label: 'Show', value: show, onChange: (v) => setShow(v as Show), options: [
                { value: 'all', label: 'All plantings' }, { value: 'growing', label: 'Growing' },
                { value: 'ready', label: 'Ready to harvest' }, { value: 'overdue', label: 'Overdue' },
                { value: 'problem', label: 'Problem reported' },
                { value: 'harvested', label: 'Harvested' }, { value: 'failed', label: 'Failed' },
              ] },
              { label: 'Crop', value: crop, onChange: setCrop, options: [
                { value: '', label: 'All crops' }, ...cropNames.map((c) => ({ value: c, label: c })),
              ] },
            ]}
            sort={{ label: 'Sort by', value: sort, onChange: (v) => setSort(v as Sort), options: [
              { value: 'harvest', label: 'Harvest date' }, { value: 'planted-desc', label: 'Planted: newest' },
              { value: 'planted-asc', label: 'Planted: oldest' }, { value: 'name', label: 'Crop (A–Z)' },
            ] }}
            shown={shownCount}
            total={plantings.length}
            noun="plantings"
            onClear={filtered ? () => { setSearch(''); setShow('all'); setCrop('') } : undefined}
          />

          {filtered && shownCount === 0 && (
            <p className="text-sm text-gray-500 mb-8">No plantings match these filters.</p>
          )}

          {attention.length > 0 && !filtered && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Needs attention</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {attention.map(({ key, planting, tone, icon: Icon, title, detail }) => (
                  <Link
                    key={key}
                    href={`/farmer/crops/${planting.id}`}
                    className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                      tone === 'red' ? 'border-red-200 bg-red-50 hover:bg-red-100/70' : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 mt-0.5 ${tone === 'red' ? 'text-red-600' : 'text-amber-700'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-soil">{planting.cropType.name} · {title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{detail}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 ml-auto text-gray-500 mt-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(!filtered || growing.length > 0) && <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Growing <span className="text-gray-500 font-normal">({growing.length})</span></h2>
            {growing.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing growing right now.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {growing.map((p) => <GrowingCard key={p.id} planting={p} />)}
              </div>
            )}
          </section>}

          {history.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Past seasons</h2>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Crop</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Planted</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-500">Outcome</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Expected</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-500">Harvested</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {history.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-soil">{p.cropType.name}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(p.plantedOn)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status].cls}`}>
                              {STATUS_STYLES[p.status].label}
                            </span>
                            {p.harvestedOn && <span className="text-xs text-gray-500 ml-2">{fmtDate(p.harvestedOn)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmtKg(p.expectedYield)}</td>
                          <td className="px-4 py-3 text-right text-soil tabular-nums">{fmtKg(p.actualYield)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/farmer/crops/${p.id}`} className="text-xs font-medium text-paddy hover:text-paddy-deep">View</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function GrowingCard({ planting: p }: { planting: Row }) {
  const badge = plantingBadge(p)
  const pct = Math.round((p.progress ?? 0) * 100)
  return (
    <Link
      href={`/farmer/crops/${p.id}`}
      className="block bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:border-paddy/40 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <p className="font-medium text-soil">{p.cropType.name}</p>
          <p className="text-xs text-gray-500 truncate">
            Planted {fmtDate(p.plantedOn)}{p.product ? ` · sold as ${p.product.name}` : ''}
          </p>
        </div>
        <span className={`ml-auto shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to harvest">
          <div className={`h-full rounded-full ${p.attention === 'overdue' ? 'bg-red-500' : 'bg-paddy-deep'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
        </div>
        <div className="flex justify-between gap-2 mt-1.5 text-xs text-gray-500">
          <span>Day {Math.max(p.day, 0)}</span>
          <span className={p.attention === 'overdue' ? 'text-red-600 font-medium' : ''}>
            Harvest {fmtWindow(p.harvestStart, p.harvestEnd)}
          </span>
        </div>
      </div>
      {p.expectedYield !== null && (
        <p className="text-xs text-gray-500 mt-2">Expected yield: <span className="text-gray-700">{fmtKg(p.expectedYield)}</span></p>
      )}
    </Link>
  )
}
