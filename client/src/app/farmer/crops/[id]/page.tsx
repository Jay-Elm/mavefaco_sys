'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  Loader2, ArrowLeft, Sprout, Save, Plus, Trash2,
  CloudRain, Bug, Flame, FileText, CheckCircle2,
} from 'lucide-react'

interface CropLog {
  id: number
  type: string
  note: string
  createdAt: string
}

interface CropDetail {
  id: number
  name: string
  stock: number
  category: { name: string }
  plantingDate: string | null
  expectedHarvestDate: string | null
  growthStage: string | null
  readyForHarvest: boolean
  cropLogs: CropLog[]
}

const GROWTH_STAGES = [
  { value: 'seedling',      label: 'Seedling' },
  { value: 'vegetative',    label: 'Vegetative' },
  { value: 'flowering',     label: 'Flowering' },
  { value: 'fruiting',      label: 'Fruiting' },
  { value: 'harvest-ready', label: 'Harvest Ready' },
  { value: 'harvested',     label: 'Harvested' },
]

const LOG_TYPES: { value: string; label: string; icon: React.ElementType; cls: string }[] = [
  { value: 'weather_impact', label: 'Weather Impact', icon: CloudRain, cls: 'text-blue-600' },
  { value: 'pest_disease',   label: 'Pest / Disease',  icon: Bug,       cls: 'text-red-600' },
  { value: 'damage',         label: 'Crop Damage',     icon: Flame,     cls: 'text-orange-600' },
  { value: 'note',           label: 'General Note',    icon: FileText,  cls: 'text-gray-600' },
]

const toDateInput = (d: string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : ''

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—'

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

export default function CropDetailPage() {
  const { token } = useAuth()
  const params = useParams()
  const productId = Number(params.id)

  const [crop, setCrop] = useState<CropDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // form state
  const [plantingDate, setPlantingDate] = useState('')
  const [harvestDate, setHarvestDate] = useState('')
  const [growthStage, setGrowthStage] = useState('')
  const [readyForHarvest, setReadyForHarvest] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // log form
  const [logType, setLogType] = useState('note')
  const [logNote, setLogNote] = useState('')
  const [addingLog, setAddingLog] = useState(false)
  const [logError, setLogError] = useState('')
  const [deletingLogId, setDeletingLogId] = useState<number | null>(null)

  useEffect(() => {
    if (!token || isNaN(productId)) return
    fetch(`/api/farmer/crops/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setCrop(d)
        setPlantingDate(toDateInput(d.plantingDate))
        setHarvestDate(toDateInput(d.expectedHarvestDate))
        setGrowthStage(d.growthStage ?? '')
        setReadyForHarvest(d.readyForHarvest)
      })
      .catch(() => setError('Failed to load crop'))
      .finally(() => setLoading(false))
  }, [token, productId])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaving(true); setSaveSuccess(false)
    try {
      const res = await fetch(`/api/farmer/crops/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plantingDate: plantingDate || null,
          expectedHarvestDate: harvestDate || null,
          growthStage: growthStage || null,
          readyForHarvest,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      setCrop((prev) => prev ? { ...prev, ...d } : prev)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !logNote.trim()) return
    setAddingLog(true); setLogError('')
    try {
      const res = await fetch(`/api/farmer/crops/${productId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: logType, note: logNote.trim() }),
      })
      const d = await res.json()
      if (!res.ok) { setLogError(d.error); return }
      setCrop((prev) => prev ? { ...prev, cropLogs: [d, ...prev.cropLogs] } : prev)
      setLogNote('')
    } catch { setLogError('Failed to add log') }
    finally { setAddingLog(false) }
  }

  async function handleDeleteLog(logId: number) {
    if (!token) return
    setDeletingLogId(logId)
    try {
      await fetch(`/api/farmer/crops/${productId}/logs/${logId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setCrop((prev) => prev ? { ...prev, cropLogs: prev.cropLogs.filter((l) => l.id !== logId) } : prev)
    } catch {}
    finally { setDeletingLogId(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
  if (error || !crop) return (
    <div className="p-8 text-red-600 text-sm">{error || 'Crop not found'}</div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/farmer/crops" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 mb-6">
        <ArrowLeft size={15} /> Back to Crop Monitor
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Sprout size={20} className="text-green-600 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{crop.name}</h1>
          <p className="text-sm text-gray-400">{crop.category.name} · {crop.stock} units in stock</p>
        </div>
        {crop.readyForHarvest && (
          <span className="sm:ml-auto inline-flex items-center gap-1 text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full shrink-0">
            <CheckCircle2 size={14} /> Ready for Harvest
          </span>
        )}
      </div>

      {/* Monitoring form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Crop Details</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Planting Date</label>
              <input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expected Harvest Date</label>
              <input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} className={INPUT} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Growth Stage</label>
            <select value={growthStage} onChange={(e) => setGrowthStage(e.target.value)} className={INPUT}>
              <option value="">— Select stage —</option>
              {GROWTH_STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={readyForHarvest}
              onChange={(e) => setReadyForHarvest(e.target.checked)}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm font-medium text-gray-700">Mark as Ready for Harvest</span>
          </label>

          {saveSuccess && (
            <p className="text-green-600 text-xs flex items-center gap-1">
              <CheckCircle2 size={13} /> Saved successfully
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </form>
      </div>

      {/* Crop log */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Crop Log</h2>

        {/* Add log form */}
        <form onSubmit={handleAddLog} className="space-y-3 mb-6 pb-6 border-b border-gray-100">
          <div className="flex flex-wrap gap-2">
            {LOG_TYPES.map(({ value, label, icon: Icon, cls }) => (
              <button
                key={value}
                type="button"
                onClick={() => setLogType(value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  logType === value
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-400'
                }`}
              >
                <Icon size={13} className={logType === value ? 'text-green-600' : cls} />
                {label}
              </button>
            ))}
          </div>
          <textarea
            value={logNote}
            onChange={(e) => setLogNote(e.target.value)}
            placeholder="Describe what happened…"
            rows={2}
            className={`${INPUT} resize-none`}
          />
          {logError && <p className="text-red-500 text-xs">{logError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingLog || !logNote.trim()}
              className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              {addingLog ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Add Entry
            </button>
          </div>
        </form>

        {/* Log list */}
        {crop.cropLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No log entries yet.</p>
        ) : (
          <div className="space-y-3">
            {crop.cropLogs.map((log) => {
              const typeInfo = LOG_TYPES.find((t) => t.value === log.type) ?? LOG_TYPES[3]
              const Icon = typeInfo.icon
              return (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <Icon size={15} className={`shrink-0 mt-0.5 ${typeInfo.cls}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">{typeInfo.label}</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{log.note}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(log.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteLog(log.id)}
                    disabled={deletingLogId === log.id}
                    className="shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {deletingLogId === log.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Trash2 size={13} />}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
