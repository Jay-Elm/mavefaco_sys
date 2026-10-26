'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Loader2, Sprout } from 'lucide-react'
import { harvestWindow, todayPH } from '@/lib/planting'
import { INPUT, fmtWindow, type CropType } from '@/components/cropDisplay'

interface Listing { id: number; name: string }

export default function NewPlantingPage() {
  const { token, user } = useAuth()
  const router = useRouter()
  const [cropTypes, setCropTypes] = useState<CropType[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const [cropTypeId, setCropTypeId] = useState('')
  const [plantedOn, setPlantedOn] = useState(todayPH())
  const [areaSqm, setAreaSqm] = useState('')
  const [expectedYield, setExpectedYield] = useState('')
  const [productId, setProductId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !user) return
    const headers = { Authorization: `Bearer ${token}` }
    Promise.all([
      fetch('/api/crop-types', { headers }).then((r) => r.json()),
      fetch(`/api/products?farmerId=${user.id}`, { headers }).then((r) => r.json()),
    ])
      .then(([types, products]) => {
        if (Array.isArray(types)) setCropTypes(types)
        if (Array.isArray(products)) setListings(products)
      })
      .catch(() => setError('Failed to load the crop list'))
      .finally(() => setLoading(false))
  }, [token, user])

  const crop = cropTypes.find((c) => String(c.id) === cropTypeId)
  const preview = crop && plantedOn ? harvestWindow(crop, plantedOn) : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/farmer/plantings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          cropTypeId: Number(cropTypeId),
          plantedOn,
          areaSqm: areaSqm ? Number(areaSqm) : null,
          expectedYield: expectedYield ? Number(expectedYield) : null,
          productId: productId ? Number(productId) : null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error); return }
      router.push(`/farmer/crops/${d.id}`)
    } catch {
      setError('Failed to record planting')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-2xl">
      <Link href="/farmer/crops" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-forest mb-6">
        <ArrowLeft size={15} /> Back to Crop Monitor
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <Sprout size={20} className="text-forest" />
        <h1 className="font-serif text-2xl font-bold text-gray-900">Record a planting</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div>
          <label htmlFor="crop" className="block text-xs font-medium text-gray-600 mb-1">Crop</label>
          <select id="crop" required value={cropTypeId} onChange={(e) => setCropTypeId(e.target.value)} className={INPUT}>
            <option value="">— Choose a crop —</option>
            {cropTypes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {crop && (
            <p className="text-xs text-gray-500 mt-1">Usually ready {crop.daysToHarvestMin}–{crop.daysToHarvestMax} days after planting.</p>
          )}
        </div>

        <div>
          <label htmlFor="plantedOn" className="block text-xs font-medium text-gray-600 mb-1">Planting date</label>
          <input id="plantedOn" type="date" required max={todayPH()} value={plantedOn} onChange={(e) => setPlantedOn(e.target.value)} className={INPUT} />
          <p className="text-xs text-gray-500 mt-1">For seedlings, the day they went into the field.</p>
        </div>

        {preview && (
          <div className="rounded-lg bg-tint border border-forest/10 px-4 py-3 text-sm text-gray-700">
            Expected harvest: <span className="font-semibold text-forest">{fmtWindow(preview.harvestStart, preview.harvestEnd)}</span>
            <span className="block text-xs text-gray-500 mt-0.5">You can adjust this later. Growing times are approximate.</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="area" className="block text-xs font-medium text-gray-600 mb-1">Area planted (m²) <span className="text-gray-400">optional</span></label>
            <input id="area" type="number" min="0" step="any" inputMode="decimal" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label htmlFor="yield" className="block text-xs font-medium text-gray-600 mb-1">Expected yield (kg) <span className="text-gray-400">optional</span></label>
            <input id="yield" type="number" min="0" step="any" inputMode="decimal" value={expectedYield} onChange={(e) => setExpectedYield(e.target.value)} className={INPUT} />
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-2">Your expected yield helps the cooperative plan for upcoming supply.</p>

        <div>
          <label htmlFor="listing" className="block text-xs font-medium text-gray-600 mb-1">Sold as <span className="text-gray-400">optional</span></label>
          <select id="listing" value={productId} onChange={(e) => setProductId(e.target.value)} className={INPUT}>
            <option value="">Not linked to a listing yet</option>
            {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <p className="text-xs text-gray-500 mt-1">Link a listing to add the harvest to its stock in one step.</p>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving || !cropTypeId}
            className="inline-flex items-center gap-2 bg-forest hover:bg-forest-mid disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Record planting
          </button>
          <Link href="/farmer/crops" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
