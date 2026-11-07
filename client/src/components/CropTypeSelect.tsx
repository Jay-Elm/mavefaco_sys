'use client'

import { useEffect, useRef, useState } from 'react'
import { suggestCropType } from '@/lib/cropKeywords'

interface Crop { id: number; name: string }

/**
 * Which crop a listing sells, so its sales count toward that crop's market
 * demand. Fills itself in from the listing name until the farmer picks one
 * by hand. Customers never see it, so changing it needs no review.
 */
export default function CropTypeSelect({
  token,
  listingName,
  value,
  onChange,
}: {
  token: string | null
  listingName: string
  /** The crop's id as a string, or '' for none. */
  value: string
  onChange: (value: string) => void
}) {
  const [crops, setCrops] = useState<Crop[]>([])
  // Once chosen by hand (or loaded from a saved listing), stop guessing.
  const touched = useRef(value !== '')

  useEffect(() => {
    if (!token) return
    fetch('/api/crop-types', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCrops(d))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    if (value !== '') touched.current = true
  }, [value])

  useEffect(() => {
    if (touched.current || crops.length === 0) return
    const guess = suggestCropType(listingName, crops)
    const next = guess ? String(guess.id) : ''
    if (next !== value) onChange(next)
    // Only re-guess when the name or the crop list changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingName, crops])

  return (
    <div>
      <label htmlFor="crop-type" className="block text-sm font-medium text-gray-700 mb-1">
        Crop <span className="text-gray-500">(optional)</span>
      </label>
      <select
        id="crop-type"
        value={value}
        onChange={(e) => { touched.current = true; onChange(e.target.value) }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
      >
        <option value="">Not a listed crop</option>
        {crops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <p className="mt-1 text-xs text-gray-500">
        Counts this listing&apos;s sales toward the crop on the Market page. Customers don&apos;t see it.
      </p>
    </div>
  )
}
