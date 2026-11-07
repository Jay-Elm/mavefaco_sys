'use client'

import { useEffect, useState } from 'react'
import { Tag } from 'lucide-react'
import { fmtMonth } from './marketTypes'

interface Ref {
  crop: { id: number; name: string }
  albay: { month: string; pricePerKg: number } | null
  bicol: { month: string; pricePerKg: number } | null
  source: string
}

/**
 * Pricing guidance on Add/Edit Product: the latest PSA farmgate price for
 * the listing's crop in Albay and the Bicol region. For reference only;
 * the farmer sets their own price.
 */
export default function PriceReference({ token, cropTypeId, unit }: { token: string | null; cropTypeId: string; unit: string }) {
  const [ref, setRef] = useState<Ref | null>(null)

  useEffect(() => {
    if (!token || !cropTypeId) return
    let cancelled = false
    fetch(`/api/market/reference?cropTypeId=${cropTypeId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRef(d.error ? null : d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, cropTypeId])

  if (!cropTypeId || !ref || String(ref.crop.id) !== cropTypeId || (!ref.albay && !ref.bicol)) return null
  const line = (label: string, p: Ref['albay']) => p && <li>{label}: <strong className="font-semibold text-soil">₱{p.pricePerKg.toFixed(2)} per kg</strong> ({fmtMonth(p.month)})</li>

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
      <p className="flex items-center gap-1.5 font-medium text-gray-700"><Tag size={13} aria-hidden /> Price reference for {ref.crop.name}</p>
      <ul className="mt-1 space-y-0.5">
        {line('Albay farmgate', ref.albay)}
        {line('Bicol region farmgate', ref.bicol)}
      </ul>
      <p className="mt-1 text-gray-500">
        What farmers were paid, from the {ref.source}. Shoppers usually pay more. You set your own price
        {!/^(kg|kilo)/i.test(unit) ? `; yours is per ${unit}, these are per kg` : ''}.
      </p>
    </div>
  )
}
