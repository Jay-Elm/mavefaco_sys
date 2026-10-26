'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AlertTriangle, CalendarRange, ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import { addDays } from '@/lib/planting'
import { fmtDate, fmtKg, fmtWindow } from '@/components/cropDisplay'

interface SupplyPlanting {
  id: number
  farmer: { id: number; name: string }
  cropType: { id: number; name: string }
  plantedOn: string
  harvestStart: string
  harvestEnd: string
  areaSqm: number | null
  expectedYield: number | null
}
interface Supply {
  today: string
  weeks: string[]
  crops: { cropType: { id: number; name: string }; weekly: { kg: number; farms: number; clash: boolean }[]; totalKg: number; plantings: SupplyPlanting[] }[]
  withoutYield: number
  clashFarms: number
  overdue: SupplyPlanting[]
}

// One-hue sequential ramp (light = little, dark = a lot), in the portal's green.
const RAMP = ['#e3f1e8', '#bfe0ca', '#8fc6a0', '#5ea477', '#2e6649']
const INK_ON = ['text-gray-900', 'text-gray-900', 'text-gray-900', 'text-white', 'text-white']

const weekLabel = (start: string) =>
  new Date(`${start}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export default function SupplyPage() {
  const { token } = useAuth()
  const [data, setData] = useState<Supply | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [hover, setHover] = useState<{ crop: string; week: string; kg: number; farms: number; clash: boolean; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/supply', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Failed to load supply'))
      .finally(() => setLoading(false))
  }, [token])

  const maxKg = useMemo(() => Math.max(0, ...(data?.crops.flatMap((c) => c.weekly.map((w) => w.kg)) ?? [])), [data])
  const step = (kg: number) => (kg <= 0 || maxKg === 0 ? -1 : Math.min(RAMP.length - 1, Math.ceil((kg / maxKg) * RAMP.length) - 1))

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
  if (error || !data) return <div className="p-8 text-red-600 text-sm">{error || 'No data'}</div>

  const total = data.crops.reduce((s, c) => s + c.totalKg, 0)
  const plantingCount = data.crops.reduce((s, c) => s + c.plantings.length, 0)
  const clashes = data.crops.flatMap((c) => c.weekly.map((w, i) => ({ crop: c.cropType.name, week: data.weeks[i], ...w }))).filter((w) => w.clash)

  function exportCsv() {
    if (!data) return
    downloadCSV(
      'upcoming-supply.csv',
      ['Crop', ...data.weeks.map((w) => `Week of ${w} (kg)`), 'Total (kg)'],
      data.crops.map((c) => [c.cropType.name, ...c.weekly.map((w) => w.kg), c.totalKg]),
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <CalendarRange size={22} className="text-forest" />
        <h1 className="font-serif text-2xl font-bold text-gray-900">Upcoming Supply</h1>
        <button
          onClick={exportCsv}
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        Expected harvests over the next {data.weeks.length} weeks, from members&apos; growing plantings. Yields are
        farmers&apos; own estimates, spread evenly across each planting&apos;s harvest window; harvest windows come from
        approximate growing times.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Tile label={`Expected, next ${data.weeks.length} weeks`} value={fmtKg(total)} />
        <Tile label="Plantings due to harvest" value={String(plantingCount)} />
        <Tile label="Without a yield estimate" value={String(data.withoutYield)} note={data.withoutYield > 0 ? 'Counted as farms, not kg' : undefined} />
        <Tile label="Harvest window passed" value={String(data.overdue.length)} warn={data.overdue.length > 0} note="Not yet recorded" />
      </div>

      {data.crops.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-center py-14 text-gray-500 text-sm">
          No harvests expected in the next {data.weeks.length} weeks. Farmers record plantings in their Crop Monitor.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm border-separate border-spacing-0">
              <caption className="sr-only">Expected harvest in kilograms by crop and week</caption>
              <thead>
                <tr className="bg-gray-50">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-gray-500 border-b border-gray-200">Crop</th>
                  {data.weeks.map((w, i) => (
                    <th key={w} scope="col" className="px-1 py-3 text-center font-medium text-gray-500 border-b border-gray-200 whitespace-nowrap">
                      <span className="block text-xs">{i === 0 ? 'This week' : 'Week of'}</span>
                      <span className="text-gray-700">{weekLabel(w)}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right font-medium text-gray-500 border-b border-gray-200">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.crops.map((c) => (
                  <Fragment key={c.cropType.id}>
                    <tr>
                      <th scope="row" className="px-4 py-1.5 text-left font-medium text-gray-900 border-b border-gray-100">
                        <button
                          onClick={() => setOpen(open === c.cropType.id ? null : c.cropType.id)}
                          aria-expanded={open === c.cropType.id}
                          className="inline-flex items-center gap-1 hover:text-forest"
                        >
                          {open === c.cropType.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {c.cropType.name}
                          <span className="text-xs font-normal text-gray-400 ml-1">{c.plantings.length}</span>
                        </button>
                      </th>
                      {c.weekly.map((w, i) => {
                        const s = step(w.kg)
                        return (
                          <td key={i} className="p-0.5 border-b border-gray-100">
                            <div
                              tabIndex={0}
                              onMouseEnter={(e) => setHover({ crop: c.cropType.name, week: data.weeks[i], ...w, x: e.clientX, y: e.clientY })}
                              onMouseMove={(e) => setHover((h) => (h ? { ...h, x: e.clientX, y: e.clientY } : h))}
                              onMouseLeave={() => setHover(null)}
                              onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover({ crop: c.cropType.name, week: data.weeks[i], ...w, x: r.right, y: r.top }) }}
                              onBlur={() => setHover(null)}
                              className={`relative h-11 rounded flex flex-col items-center justify-center text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-forest ${s >= 0 ? INK_ON[s] : w.farms > 0 ? 'text-gray-500 border border-dashed border-gray-300' : 'text-gray-300 bg-gray-50'}`}
                              style={s >= 0 ? { backgroundColor: RAMP[s] } : undefined}
                            >
                              {w.farms === 0 ? '—' : (
                                <>
                                  <span className="font-semibold">{w.kg > 0 ? Math.round(w.kg).toLocaleString('en-PH') : '?'}</span>
                                  <span className="opacity-80 text-[10px]">{w.farms} {w.farms === 1 ? 'farm' : 'farms'}</span>
                                </>
                              )}
                              {w.clash && (
                                <AlertTriangle size={12} className="absolute top-0.5 right-0.5 text-amber-600 fill-amber-100" aria-label="Many farms harvesting" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-4 py-1.5 text-right font-semibold text-gray-900 tabular-nums border-b border-gray-100">
                        {c.totalKg > 0 ? fmtKg(c.totalKg) : <span className="font-normal text-gray-400">No estimate</span>}
                      </td>
                    </tr>
                    {open === c.cropType.id && (
                      <tr>
                        <td colSpan={data.weeks.length + 2} className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                          <PlantingTable plantings={c.plantings} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.crops.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500 mb-8">
          <span className="inline-flex items-center gap-2">
            Less
            <span className="flex">{RAMP.map((c) => <span key={c} className="w-5 h-3 first:rounded-l last:rounded-r" style={{ backgroundColor: c }} />)}</span>
            More kg
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle size={12} className="text-amber-600 fill-amber-100" /> {data.clashFarms}+ farms harvesting the same crop that week: possible oversupply
          </span>
          <span>? = farms gave no yield estimate</span>
        </div>
      )}

      {clashes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm">
          <p className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-amber-600" /> Possible oversupply
          </p>
          <ul className="text-gray-700 space-y-0.5">
            {clashes.map((c) => (
              <li key={`${c.crop}${c.week}`}>
                {c.crop}, week of {fmtDate(c.week)}: {c.farms} farms, about {fmtKg(Math.round(c.kg))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 mt-2">Consider staggering plantings, or lining up buyers for these weeks.</p>
        </div>
      )}

      {data.overdue.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Harvest window passed, not yet recorded</h2>
          <p className="text-xs text-gray-500 mb-3">Not counted above. The farmer may have harvested without recording it, or the crop may be late.</p>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <PlantingTable plantings={data.overdue} showCrop />
          </div>
        </section>
      )}

      {hover && (
        <div
          role="tooltip"
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <p className="font-semibold">{hover.crop}</p>
          <p className="text-white/70">{fmtWindow(hover.week, addDays(hover.week, 6))}</p>
          <p className="mt-1">{hover.farms === 0 ? 'No harvests expected' : `${fmtKg(hover.kg)} from ${hover.farms} ${hover.farms === 1 ? 'farm' : 'farms'}`}</p>
          {hover.clash && <p className="text-amber-300 mt-0.5">Possible oversupply</p>}
        </div>
      )}
    </div>
  )
}

function Tile({ label, value, note, warn }: { label: string; value: string; note?: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums flex items-center gap-2">
        {value}
        {warn && <AlertTriangle size={16} className="text-amber-600" aria-label="Needs follow-up" />}
      </p>
      {note && <p className="text-[11px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  )
}

function PlantingTable({ plantings, showCrop = false }: { plantings: SupplyPlanting[]; showCrop?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="py-1.5 pr-3 text-left font-medium">Farmer</th>
            {showCrop && <th className="py-1.5 pr-3 text-left font-medium">Crop</th>}
            <th className="py-1.5 pr-3 text-left font-medium">Planted</th>
            <th className="py-1.5 pr-3 text-left font-medium">Harvest window</th>
            <th className="py-1.5 pr-3 text-right font-medium">Area</th>
            <th className="py-1.5 text-right font-medium">Expected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200/70">
          {plantings.map((p) => (
            <tr key={p.id} className="text-gray-700">
              <td className="py-1.5 pr-3 font-medium text-gray-900">{p.farmer.name}</td>
              {showCrop && <td className="py-1.5 pr-3">{p.cropType.name}</td>}
              <td className="py-1.5 pr-3">{fmtDate(p.plantedOn)}</td>
              <td className="py-1.5 pr-3">{fmtWindow(p.harvestStart, p.harvestEnd)}</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{p.areaSqm === null ? '—' : `${p.areaSqm.toLocaleString('en-PH')} m²`}</td>
              <td className="py-1.5 text-right tabular-nums">{fmtKg(p.expectedYield)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
