'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/contexts/DialogContext'
import { ArrowLeft, CheckCircle2, Loader2, Plus, Save, Sprout, Trash2, Wheat, XCircle } from 'lucide-react'
import { CROP_PESTS, PEST_LABELS } from '@/validators/crop'
import { addDays, daysBetween, todayPH } from '@/lib/planting'
import {
  INPUT, LOG_TYPES, SEVERITY_STYLES, STAGE_STYLES, STATUS_STYLES, fmtDate, fmtKg, fmtWindow,
  type CropLog, type Planting,
} from '@/components/cropDisplay'

type Detail = Planting & { logs: CropLog[] }
interface Listing { id: number; name: string; unit: string }

export default function PlantingPage() {
  const { token, user } = useAuth()
  const dialog = useDialog()
  const router = useRouter()
  const plantingId = Number(useParams().id)

  const [planting, setPlanting] = useState<Detail | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !user || isNaN(plantingId)) return
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch(`/api/farmer/plantings/${plantingId}`, { headers }).then((r) => r.json()),
      fetch(`/api/products?farmerId=${user.id}`, { headers }).then((r) => r.json()),
    ])
      .then(([p, products]) => {
        if (p.error) setError(p.error)
        else setPlanting(p)
        if (Array.isArray(products)) setListings(products)
      })
      .catch(() => setError('Failed to load this planting'))
      .finally(() => setLoading(false))
  }, [token, user, plantingId])

  async function send(path: string, method: string, body?: unknown) {
    const res = await fetch(`/api/farmer/plantings/${plantingId}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, data }
  }

  // Keeps the log when the planting itself is updated.
  const applyUpdate = (p: Planting) => setPlanting((prev) => (prev ? { ...p, logs: prev.logs } : prev))

  async function changeStatus(status: 'failed' | 'growing') {
    const ok = await dialog.confirm(
      status === 'failed'
        ? { title: 'Mark this planting as failed?', message: 'Use this when the crop was lost and there will be no harvest.', confirmLabel: 'Mark failed', tone: 'danger' }
        : { title: 'Move back to growing?', message: 'This clears the recorded harvest. Stock already added to your listing stays.', confirmLabel: 'Move back' },
    )
    if (!ok) return
    const { ok: done, data } = await send('', 'PATCH', { status })
    if (!done) { await dialog.alert({ title: "Couldn't update the planting", message: data.error ?? 'Please try again.' }); return }
    applyUpdate(data)
  }

  async function handleDelete() {
    if (!(await dialog.confirm({ title: 'Delete this planting?', message: 'Its log entries are deleted too. Use this for a planting recorded by mistake.', confirmLabel: 'Delete', tone: 'danger' }))) return
    const { ok, data } = await send('', 'DELETE')
    if (!ok) { await dialog.alert({ title: "Couldn't delete the planting", message: data.error ?? 'Please try again.' }); return }
    router.push('/farmer/crops')
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
  if (error || !planting) return <div className="p-8 text-red-600 text-sm">{error || 'Planting not found'}</div>

  const p = planting
  const stage = p.attention === 'overdue'
    ? { label: 'Overdue', cls: 'bg-red-100 text-red-700' }
    : p.stage ? STAGE_STYLES[p.stage] : null
  const status = STATUS_STYLES[p.status]

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/farmer/crops" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-paddy mb-6">
        <ArrowLeft size={15} /> Back to Crop Monitor
      </Link>

      <div className="flex flex-wrap items-start gap-3 mb-6">
        <Sprout size={20} className="text-paddy shrink-0 mt-1.5" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-soil">{p.cropType.name}</h1>
          <p className="text-sm text-gray-500">
            Planted {fmtDate(p.plantedOn)}
            {p.areaSqm !== null && ` · ${p.areaSqm.toLocaleString('en-PH')} m²`}
            {p.product && ` · sold as ${p.product.name}`}
          </p>
        </div>
        <span className={`sm:ml-auto shrink-0 text-sm font-semibold px-3 py-1 rounded-full ${stage ? stage.cls : status.cls}`}>
          {stage ? stage.label : status.label}
        </span>
      </div>

      {p.status === 'growing' ? (
        <>
          <Timeline planting={p} />
          <HarvestPanel planting={p} send={send} onDone={applyUpdate} onFail={() => changeStatus('failed')} />
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          {p.status === 'harvested' ? (
            <>
              <Fact label="Harvested" value={fmtDate(p.harvestedOn)} />
              <Fact label="Expected yield" value={fmtKg(p.expectedYield)} />
              <Fact label="Actual yield" value={fmtKg(p.actualYield)} />
            </>
          ) : (
            <p className="text-sm text-gray-700">This planting was marked as failed.</p>
          )}
          <button onClick={() => changeStatus('growing')} className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-800 underline">
            Move back to growing
          </button>
        </div>
      )}

      <DetailsForm planting={p} listings={listings} send={send} onSaved={applyUpdate} />
      <LogSection planting={p} send={send} onChange={(logs) => setPlanting((prev) => (prev ? { ...prev, logs } : prev))} />

      <div className="mt-8 pt-6 border-t border-gray-200">
        <button onClick={handleDelete} className="inline-flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700">
          <Trash2 size={13} /> Delete this planting
        </button>
      </div>
    </div>
  )
}

type Send = (path: string, method: string, body?: unknown) => Promise<{ ok: boolean; data: any }> // eslint-disable-line @typescript-eslint/no-explicit-any

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-soil">{value}</p>
    </div>
  )
}

/** The planting's life so far: growth stages as segments, the harvest window, and today. */
function Timeline({ planting: p }: { planting: Planting }) {
  const total = Math.max(daysBetween(p.plantedOn, p.harvestEnd), 1)
  const harvestDay = daysBetween(p.plantedOn, p.harvestStart)
  const t = p.cropType
  const starts = [
    { key: 'seedling', day: 0 },
    { key: 'vegetative', day: t.vegetativeDay },
    ...(t.floweringDay !== null ? [{ key: 'flowering', day: t.floweringDay }] : []),
    ...(t.fruitingDay !== null ? [{ key: 'fruiting', day: t.fruitingDay }] : []),
  ].filter((s) => s.day < harvestDay)
  const segments = [
    ...starts.map((s, i) => ({ ...s, end: i + 1 < starts.length ? starts[i + 1].day : harvestDay })),
    { key: 'harvest-ready', day: harvestDay, end: total },
  ]
  const todayPct = Math.min(100, Math.max(0, (p.day / total) * 100))
  const COLORS: Record<string, string> = {
    seedling: 'bg-lime-300', vegetative: 'bg-paddy/70', flowering: 'bg-pink-300', fruiting: 'bg-orange-300', 'harvest-ready': 'bg-amber-400',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Growth timeline</h2>
        <p className={`text-sm ${p.attention === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
          Harvest {fmtWindow(p.harvestStart, p.harvestEnd)}
        </p>
      </div>
      <div className="relative pt-6">
        <div
          className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
          style={{ left: `${todayPct}%` }}
        >
          <span className="text-[11px] font-semibold text-paddy whitespace-nowrap">Today · day {Math.max(p.day, 0)}</span>
        </div>
        <div className="relative flex h-3 rounded-full overflow-hidden bg-gray-100">
          {segments.map((s) => (
            <div key={s.key} className={`${COLORS[s.key]} ${s.day / total * 100 > todayPct ? 'opacity-35' : ''}`} style={{ width: `${((s.end - s.day) / total) * 100}%` }} title={STAGE_STYLES[s.key].label} />
          ))}
          <div className="absolute inset-y-0 w-0.5 bg-paddy" style={{ left: `${todayPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {segments.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-2.5 h-2.5 rounded-sm ${COLORS[s.key]}`} />
              {STAGE_STYLES[s.key].label} <span className="text-gray-500">{fmtDate(addDays(p.plantedOn, s.day))}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">Stages are worked out from typical growing times for {p.cropType.name}; they&apos;re approximate.</p>
    </div>
  )
}

function HarvestPanel({ planting: p, send, onDone, onFail }: { planting: Planting; send: Send; onDone: (p: Planting) => void; onFail: () => void }) {
  const [open, setOpen] = useState(p.attention !== null)
  const [harvestedOn, setHarvestedOn] = useState(todayPH())
  const [actualYield, setActualYield] = useState('')
  const [addToStock, setAddToStock] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const listing = p.product && !p.product.archivedAt ? p.product : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const { ok, data } = await send('/harvest', 'POST', {
      harvestedOn,
      actualYield: actualYield ? Number(actualYield) : null,
      addToStock: addToStock ? Number(addToStock) : null,
    })
    setSaving(false)
    if (!ok) { setError(data.error ?? 'Failed to record harvest'); return }
    onDone(data)
  }

  return (
    <div className={`rounded-lg border shadow-sm p-5 mb-6 ${p.attention ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Wheat size={18} className="text-amber-700" />
        <div>
          <p className="text-sm font-semibold text-soil">
            {p.attention === 'overdue' ? 'The harvest window has passed' : p.attention === 'harvest-now' ? 'Ready to harvest' : 'Harvest'}
          </p>
          <p className="text-xs text-gray-600">Record the harvest when it&apos;s in, or mark the planting failed if the crop was lost.</p>
        </div>
        {!open && (
          <div className="flex gap-2 ml-auto">
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep text-white text-xs font-medium px-3 py-2 rounded-lg">
              <CheckCircle2 size={13} /> Record harvest
            </button>
            <button onClick={onFail} className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-600 hover:text-red-600 text-xs font-medium px-3 py-2 rounded-lg bg-white">
              <XCircle size={13} /> Mark failed
            </button>
          </div>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="harvestedOn" className="block text-xs font-medium text-gray-600 mb-1">Harvest date</label>
            <input id="harvestedOn" type="date" required min={p.plantedOn} max={todayPH()} value={harvestedOn} onChange={(e) => setHarvestedOn(e.target.value)} className={`${INPUT} bg-white`} />
          </div>
          <div>
            <label htmlFor="actualYield" className="block text-xs font-medium text-gray-600 mb-1">Amount harvested (kg)</label>
            <input id="actualYield" type="number" min="0" step="any" inputMode="decimal" value={actualYield} onChange={(e) => setActualYield(e.target.value)} className={`${INPUT} bg-white`} placeholder={p.expectedYield !== null ? `Expected ${p.expectedYield}` : ''} />
          </div>
          <div>
            <label htmlFor="addToStock" className="block text-xs font-medium text-gray-600 mb-1">
              Add to stock {listing && <span className="text-gray-500">({listing.unit})</span>}
            </label>
            <input id="addToStock" type="number" min="0" step="any" inputMode="decimal" disabled={!listing} value={addToStock} onChange={(e) => setAddToStock(e.target.value)} className={`${INPUT} bg-white disabled:bg-gray-100`} />
            <p className="text-[11px] text-gray-500 mt-1">
              {listing ? `Adds to "${listing.name}" without sending it for review.` : 'Link a listing below to add stock here.'}
            </p>
          </div>
          {error && <p className="sm:col-span-3 text-red-600 text-sm">{error}</p>}
          <div className="sm:col-span-3 flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Save harvest
            </button>
            <button type="button" onClick={onFail} className="text-sm text-gray-500 hover:text-red-600">Mark failed instead</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-800 ml-auto">Close</button>
          </div>
        </form>
      )}
    </div>
  )
}

function DetailsForm({ planting: p, listings, send, onSaved }: { planting: Planting; listings: Listing[]; send: Send; onSaved: (p: Planting) => void }) {
  const [plantedOn, setPlantedOn] = useState(p.plantedOn)
  const [harvestStart, setHarvestStart] = useState(p.harvestStart)
  const [harvestEnd, setHarvestEnd] = useState(p.harvestEnd)
  const [areaSqm, setAreaSqm] = useState(p.areaSqm?.toString() ?? '')
  const [expectedYield, setExpectedYield] = useState(p.expectedYield?.toString() ?? '')
  const [productId, setProductId] = useState(p.product?.id.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Follow the planting when it changes elsewhere on the page (a harvest, say).
  const [synced, setSynced] = useState(p)
  if (synced !== p) {
    setSynced(p)
    setPlantedOn(p.plantedOn); setHarvestStart(p.harvestStart); setHarvestEnd(p.harvestEnd)
    setAreaSqm(p.areaSqm?.toString() ?? ''); setExpectedYield(p.expectedYield?.toString() ?? '')
    setProductId(p.product?.id.toString() ?? '')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    const windowChanged = harvestStart !== p.harvestStart || harvestEnd !== p.harvestEnd
    const { ok, data } = await send('', 'PATCH', {
      ...(plantedOn !== p.plantedOn && { plantedOn }),
      // A new planting date alone moves the window with it.
      ...(windowChanged && { harvestStart, harvestEnd }),
      areaSqm: areaSqm ? Number(areaSqm) : null,
      expectedYield: expectedYield ? Number(expectedYield) : null,
      productId: productId ? Number(productId) : null,
    })
    setSaving(false)
    if (!ok) { setError(data.error ?? 'Failed to save'); return }
    onSaved(data)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // The linked listing may be archived now: keep it selectable so saving doesn't unlink it by surprise.
  const options = p.product && !listings.some((l) => l.id === p.product!.id) ? [...listings, p.product] : listings

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Planting details</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="d-planted" className="block text-xs font-medium text-gray-600 mb-1">Planting date</label>
            <input id="d-planted" type="date" required max={todayPH()} value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="d-hs" className="block text-xs font-medium text-gray-600 mb-1">Harvest from</label>
            <input id="d-hs" type="date" required value={harvestStart} onChange={(e) => setHarvestStart(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="d-he" className="block text-xs font-medium text-gray-600 mb-1">Harvest until</label>
            <input id="d-he" type="date" required min={harvestStart} value={harvestEnd} onChange={(e) => setHarvestEnd(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="d-area" className="block text-xs font-medium text-gray-600 mb-1">Area (m²)</label>
            <input id="d-area" type="number" min="0" step="any" inputMode="decimal" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="d-yield" className="block text-xs font-medium text-gray-600 mb-1">Expected yield (kg)</label>
            <input id="d-yield" type="number" min="0" step="any" inputMode="decimal" value={expectedYield} onChange={(e) => setExpectedYield(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="d-listing" className="block text-xs font-medium text-gray-600 mb-1">Sold as</label>
            <select id="d-listing" value={productId} onChange={(e) => setProductId(e.target.value)} className={INPUT}>
              <option value="">Not linked</option>
              {options.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save changes
          </button>
          {saved && <span className="text-paddy text-xs inline-flex items-center gap-1"><CheckCircle2 size={13} /> Saved</span>}
        </div>
      </form>
    </div>
  )
}

function LogSection({ planting: p, send, onChange }: { planting: Detail; send: Send; onChange: (logs: CropLog[]) => void }) {
  const dialog = useDialog()
  const [type, setType] = useState('pest_disease')
  const [pest, setPest] = useState('')
  const [severity, setSeverity] = useState('')
  const [observedOn, setObservedOn] = useState(todayPH())
  const [note, setNote] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true); setError('')
    const { ok, data } = await send('/logs', 'POST', {
      type, note: note.trim(), observedOn,
      severity: type === 'note' ? null : severity || null,
      pest: type === 'pest_disease' ? pest || null : null,
    })
    setAdding(false)
    if (!ok) { setError(data.error ?? 'Failed to add entry'); return }
    onChange([data, ...p.logs].sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.id - a.id))
    setNote(''); setPest(''); setSeverity('')
  }

  async function remove(logId: number) {
    if (!(await dialog.confirm({ title: 'Delete this log entry?', confirmLabel: 'Delete', tone: 'danger' }))) return
    setDeletingId(logId)
    const { ok, data } = await send(`/logs/${logId}`, 'DELETE')
    setDeletingId(null)
    if (!ok) { await dialog.alert({ title: "Couldn't delete the entry", message: data.error ?? 'Please try again.' }); return }
    onChange(p.logs.filter((l) => l.id !== logId))
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Crop log</h2>
      <p className="text-xs text-gray-500 mb-4">Pest, weather and damage reports are shared with other members in the community advisory, under the crop&apos;s name only.</p>

      <form onSubmit={add} className="space-y-3 mb-6 pb-6 border-b border-gray-100">
        <div className="flex flex-wrap gap-2">
          {LOG_TYPES.map(({ value, label, icon: Icon, cls }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              aria-pressed={type === value}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                type === value ? 'border-paddy bg-field text-paddy' : 'border-gray-200 text-gray-500 hover:border-gray-400'
              }`}
            >
              <Icon size={13} className={type === value ? 'text-paddy' : cls} />
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {type === 'pest_disease' && (
            <div>
              <label htmlFor="pest" className="block text-xs font-medium text-gray-600 mb-1">Pest or disease</label>
              <select id="pest" required value={pest} onChange={(e) => setPest(e.target.value)} className={INPUT}>
                <option value="">— Choose —</option>
                {CROP_PESTS.map((k) => <option key={k} value={k}>{PEST_LABELS[k]}</option>)}
              </select>
            </div>
          )}
          {type !== 'note' && (
            <div>
              <span className="block text-xs font-medium text-gray-600 mb-1">Severity</span>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Severity">
                {Object.entries(SEVERITY_STYLES).map(([value, s]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={severity === value}
                    onClick={() => setSeverity(value)}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      severity === value ? `${s.cls} border-transparent ring-2 ring-paddy/40` : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label htmlFor="observedOn" className="block text-xs font-medium text-gray-600 mb-1">Date seen</label>
            <input id="observedOn" type="date" required min={p.plantedOn} max={todayPH()} value={observedOn} onChange={(e) => setObservedOn(e.target.value)} className={INPUT} />
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you see? How much of the crop is affected?"
          rows={2}
          className={`${INPUT} resize-none`}
          aria-label="Note"
        />
        {error && <p className="text-red-500 text-xs">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={adding || !note.trim()}
            className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg"
          >
            {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add entry
          </button>
        </div>
      </form>

      {p.logs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">No log entries yet.</p>
      ) : (
        <div className="space-y-3">
          {p.logs.map((log) => {
            const info = LOG_TYPES.find((t) => t.value === log.type) ?? LOG_TYPES[3]
            const Icon = info.icon
            const sev = log.severity ? SEVERITY_STYLES[log.severity] : null
            return (
              <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <Icon size={15} className={`shrink-0 mt-0.5 ${info.cls}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-600 mb-0.5 flex flex-wrap items-center gap-1.5">
                    {log.pest ? PEST_LABELS[log.pest as keyof typeof PEST_LABELS] ?? log.pest : info.label}
                    {sev && <span className={`px-1.5 py-px rounded text-[10px] font-semibold ${sev.cls}`}>{sev.label}</span>}
                  </p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.note}</p>
                  <p className="text-xs text-gray-500 mt-1">Seen {fmtDate(log.observedOn)}</p>
                </div>
                <button
                  onClick={() => remove(log.id)}
                  disabled={deletingId === log.id}
                  aria-label="Delete entry"
                  className="shrink-0 p-1 text-gray-500 hover:text-red-500 disabled:opacity-40"
                >
                  {deletingId === log.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
