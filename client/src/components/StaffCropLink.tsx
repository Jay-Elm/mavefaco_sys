'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import CropPicker, { type PickerCrop } from '@/components/CropPicker'

/**
 * Staff link a listing to its crop in place (saved on choosing). Unlinked
 * listings are outlined so they stand out, especially at review time.
 */
export default function StaffCropLink({
  productId,
  cropTypeId,
  notACrop,
  crops,
  token,
  onSaved,
}: {
  productId: number
  cropTypeId: number | null
  notACrop: boolean
  crops: PickerCrop[]
  token: string | null
  onSaved: (link: { cropTypeId: number | null; notACrop: boolean; cropType: { id: number; name: string } | null }) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const value = notACrop ? 'none' : cropTypeId ? String(cropTypeId) : ''

  async function save(v: string) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${productId}/crop`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(v === 'none' ? { notACrop: true } : { cropTypeId: v ? Number(v) : null, notACrop: false }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Could not save'); return }
      onSaved(d)
    } catch {
      setError('Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`min-w-[170px] ${value === '' ? 'rounded-lg ring-2 ring-amber-300' : ''}`}>
      <div className="relative">
        <CropPicker crops={crops} value={value} onChange={save} label="Crop" emptyLabel="Not linked" allowEmpty allowNotACrop compact />
        {saving && <Loader2 size={13} className="absolute right-7 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />}
      </div>
      {error && <p role="alert" className="mt-0.5 text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
