'use client'

import { useEffect, useState } from 'react'
import { Loader2, MapPin, Wallet } from 'lucide-react'
import GcashSettings, { type GcashDetails } from '@/components/GcashSettings'
import LocationPicker, { type SavedLocation } from '@/components/LocationPicker'

type Me = GcashDetails & SavedLocation

/**
 * Profile sections for GCash details (customers and farmers) and the saved
 * delivery spot (customers only).
 */
export default function ProfilePaymentSections({ token, forFarmer }: { token: string | null; forFarmer: boolean }) {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setMe(d)))
      .catch(() => setError('Could not load your GCash and delivery details'))
  }, [token])

  if (error) return <p className="mt-6 text-sm text-red-600">{error}</p>
  if (!me)
    return (
      <div className="mt-6 flex justify-center py-6 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )

  return (
    <>
      <section className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={18} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-soil">{forFarmer ? 'GCash for Payments' : 'GCash'}</h2>
        </div>
        <div className="bg-white rounded-card border border-gray-200 shadow-sm p-6">
          <GcashSettings initial={me} token={token} forFarmer={forFarmer} />
        </div>
      </section>

      {!forFarmer && (
        <section className="mt-6">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-soil">Delivery Location</h2>
          </div>
          <div className="bg-white rounded-card border border-gray-200 shadow-sm p-6">
            <LocationPicker initial={me} token={token} onSaved={(loc) => setMe({ ...me, ...loc })} />
            <p className="mt-3 text-xs text-gray-500">Only the farmer of an order you choose Delivery for sees this spot and address.</p>
          </div>
        </section>
      )}
    </>
  )
}
