'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { suggestCropType } from '@/lib/cropKeywords'
import { byCategory } from '@/lib/cropCategories'
import CropPicker, { type PickerCrop } from '@/components/CropPicker'

/**
 * Which crop a listing sells, so its sales count toward that crop on the
 * Market page, or "Not a farm crop". Fills itself in from the listing name
 * (any English, Filipino or Bikol name staff gave the crop) until the farmer
 * picks one by hand. Customers never see it, so changing it needs no review.
 */
export default function CropTypeSelect({
  token,
  listingName,
  value,
  onChange,
}: {
  token: string | null
  listingName: string
  /** '' (not linked yet), 'none' (not a farm crop), or the crop's id. */
  value: string
  onChange: (value: string) => void
}) {
  const [crops, setCrops] = useState<PickerCrop[]>([])
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

  const sorted = useMemo(() => byCategory(crops), [crops])

  return (
    <div>
      <CropPicker
        crops={sorted}
        value={value}
        onChange={(v) => { touched.current = true; onChange(v) }}
        label="Crop (optional)"
        emptyLabel="Not linked to a crop yet"
        allowEmpty
        allowNotACrop
      />
      <p className="mt-1 text-xs text-gray-500">
        Links this listing to a crop on the Market page, so its sales count there, whatever you call it. Customers don&apos;t see it.
        {value === '' && ' Not linked yet: cooperative staff may link it for you.'}
      </p>
    </div>
  )
}
