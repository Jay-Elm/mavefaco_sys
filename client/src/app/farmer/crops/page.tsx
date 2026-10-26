'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { AlertTriangle, Bug, ChevronRight, Loader2, Plus, Sprout, Wheat } from 'lucide-react'
import { PEST_LABELS } from '@/validators/crop'
import { addDays, todayPH } from '@/lib/planting'
import { STAGE_STYLES, STATUS_STYLES, fmtDate, fmtKg, fmtWindow, type Planting } from '@/components/cropDisplay'

type Row = Planting & {
  _count: { logs: number }
  latestHighSeverity: { id: number; type: string; pest: string | null; note: string; observedOn: string } | null
}

export default function CropsPage() {
  const { token } = useAuth()
  const [plantings, setPlantings] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/farmer/plantings', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setPlantings(d)))
      .catch(() => setError('Failed to load your crops'))
      .finally(() => setLoading(false))
  }, [token])

  const { growing, history, attention } = useMemo(() => {
    const twoWeeksAgo = addDays(todayPH(), -14)
    const growing = plantings.filter((p) => p.status === 'growing')
    return {
      growing: [...growing].sort((a, b) => a.harvestStart.localeCompare(b.harvestStart)),
      history: plantings.filter((p) => p.status !== 'growing'),
      attention: growing.flatMap((p) => {
        const items: { key: string; planting: Row; tone: 'red' | 'amber'; icon: typeof Bug; title: string; detail: string }[] = []
        if (p.attention === 'overdue')
          items.push({ key: `o${p.id}`, planting: p, tone: 'red', icon: AlertTriangle, title: 'Harvest window has passed',
            detail: `Expected by ${fmtDate(p.harvestEnd)}. Record the harvest, or mark it failed.` })
        else if (p.attention === 'harvest-now')
          items.push({ key: `h${p.id}`, planting: p, tone: 'amber', icon: Wheat, title: 'Ready to harvest',
            detail: `Harvest window ${fmtWindow(p.harvestStart, p.harvestEnd)}.` })
        const log = p.latestHighSeverity
        if (log && log.observedOn >= twoWeeksAgo)
          items.push({ key: `l${p.id}`, planting: p, tone: 'red', icon: Bug,
            title: `${log.pest ? PEST_LABELS[log.pest as keyof typeof PEST_LABELS] ?? 'Problem' : 'Problem'} reported, high severity`,
            detail: `${fmtDate(log.observedOn)}: ${log.note}` })
        return items
      }),
    }
  }, [plantings])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Sprout size={22} className="text-forest" />
        <h1 className="font-serif text-2xl font-bold text-gray-900">Crop Monitor</h1>
        <Link href="/farmer/advisory" className="ml-auto text-sm text-forest hover:underline">
          Community advisory
        </Link>
        <Link
          href="/farmer/crops/new"
          className="inline-flex items-center gap-1.5 bg-forest hover:bg-forest-mid text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> Record planting
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {plantings.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-16 px-6">
          <Sprout size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-700">No plantings yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Record what you plant and when. The Crop Monitor works out each crop&apos;s growth stage and
            harvest window, and tells you when it&apos;s time to harvest.
          </p>
          <Link href="/farmer/crops/new" className="mt-4 inline-block text-forest text-sm font-medium hover:underline">
            Record your first planting →
          </Link>
        </div>
      ) : (
        <>
          {attention.length > 0 && (
            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Needs attention</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {attention.map(({ key, planting, tone, icon: Icon, title, detail }) => (
                  <Link
                    key={key}
                    href={`/farmer/crops/${planting.id}`}
                    className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${
                      tone === 'red' ? 'border-red-200 bg-red-50 hover:bg-red-100/70' : 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
                    }`}
                  >
                    <Icon size={18} className={`shrink-0 mt-0.5 ${tone === 'red' ? 'text-red-600' : 'text-amber-700'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{planting.cropType.name} · {title}</p>
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{detail}</p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 ml-auto text-gray-400 mt-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Growing <span className="text-gray-400 font-normal">({growing.length})</span></h2>
            {growing.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing growing right now.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {growing.map((p) => <GrowingCard key={p.id} planting={p} />)}
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Past seasons</h2>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                          <td className="px-4 py-3 font-medium text-gray-900">{p.cropType.name}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(p.plantedOn)}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status].cls}`}>
                              {STATUS_STYLES[p.status].label}
                            </span>
                            {p.harvestedOn && <span className="text-xs text-gray-500 ml-2">{fmtDate(p.harvestedOn)}</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{fmtKg(p.expectedYield)}</td>
                          <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{fmtKg(p.actualYield)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/farmer/crops/${p.id}`} className="text-xs font-medium text-forest hover:text-forest-mid">View</Link>
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
  const stage = p.attention === 'overdue'
    ? { label: 'Overdue', cls: 'bg-red-100 text-red-700' }
    : p.stage ? STAGE_STYLES[p.stage] : null
  const pct = Math.round((p.progress ?? 0) * 100)
  return (
    <Link
      href={`/farmer/crops/${p.id}`}
      className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-forest/40 transition-colors"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{p.cropType.name}</p>
          <p className="text-xs text-gray-500 truncate">
            Planted {fmtDate(p.plantedOn)}{p.product ? ` · sold as ${p.product.name}` : ''}
          </p>
        </div>
        {stage && (
          <span className={`ml-auto shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${stage.cls}`}>{stage.label}</span>
        )}
      </div>
      <div className="mt-4">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to harvest">
          <div className={`h-full rounded-full ${p.attention === 'overdue' ? 'bg-red-500' : 'bg-forest-mid'}`} style={{ width: `${Math.max(pct, 3)}%` }} />
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
