'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Sprout, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react'

interface CropRow {
  id: number
  name: string
  stock: number
  approved: boolean
  plantingDate: string | null
  expectedHarvestDate: string | null
  growthStage: string | null
  readyForHarvest: boolean
  category: { name: string }
  _count: { cropLogs: number }
}

const STAGE_STYLES: Record<string, { label: string; cls: string }> = {
  seedling:      { label: 'Seedling',      cls: 'bg-lime-100 text-lime-700' },
  vegetative:    { label: 'Vegetative',    cls: 'bg-green-100 text-green-700' },
  flowering:     { label: 'Flowering',     cls: 'bg-pink-100 text-pink-700' },
  fruiting:      { label: 'Fruiting',      cls: 'bg-orange-100 text-orange-700' },
  'harvest-ready': { label: 'Harvest Ready', cls: 'bg-amber-100 text-amber-700' },
  harvested:     { label: 'Harvested',     cls: 'bg-gray-100 text-gray-600' },
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—'

export default function CropsPage() {
  const { token } = useAuth()
  const [crops, setCrops] = useState<CropRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/farmer/crops', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setCrops(d)))
      .catch(() => setError('Failed to load crops'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Sprout size={22} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Crop Monitor</h1>
        <span className="text-sm text-gray-400 ml-auto">{crops.length} crops</span>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {crops.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Sprout size={40} className="mx-auto mb-3" />
          <p>No products yet. Add products to start monitoring.</p>
          <Link href="/farmer/products/new" className="mt-3 inline-block text-green-700 text-sm font-medium hover:underline">
            Add Product →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Crop</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Stage</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Planted</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Est. Harvest</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Logs</th>
                <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {crops.map((c) => {
                const stage = c.growthStage ? STAGE_STYLES[c.growthStage] : null
                const isOverdue =
                  c.expectedHarvestDate &&
                  !c.readyForHarvest &&
                  new Date(c.expectedHarvestDate) < new Date()

                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.category.name}</p>
                    </td>
                    <td className="px-5 py-3">
                      {stage ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${stage.cls}`}>
                          {stage.label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{fmt(c.plantingDate)}</td>
                    <td className="px-5 py-3">
                      <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {fmt(c.expectedHarvestDate)}
                      </span>
                      {isOverdue && (
                        <span className="ml-1 text-xs text-red-500 flex items-center gap-0.5">
                          <AlertTriangle size={11} /> Overdue
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{c._count.cropLogs}</td>
                    <td className="px-5 py-3 text-center">
                      {c.readyForHarvest ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> Ready
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/farmer/crops/${c.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900"
                      >
                        Monitor <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
