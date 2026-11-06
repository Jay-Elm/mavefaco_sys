'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { Map as LeafletMap, Marker } from 'leaflet'
import { AlertTriangle, CheckCircle, Crosshair, Loader2, MapPin } from 'lucide-react'
import { BOUNDARY_CREDIT, DELIVERY_AREA_TEXT, DELIVERY_TOWNS, deliveryTownAt } from '@/lib/deliveryArea'

export interface SavedLocation {
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryAddress: string | null
  deliveryTown: string | null
}

type Point = { lat: number; lng: number }

// A plain SVG pin (no image files to load, nothing from the user in it).
const PIN_HTML =
  '<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39s13-13.4 13-24A13 13 0 0 0 2 15c0 10.6 13 24 13 24z" fill="#2f6b3a" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>'

/**
 * Pick a delivery spot: tap the map or drag the pin, or use the phone's
 * location, then add house/street/landmark details. The delivery area is
 * drawn on the map; a spot outside it can still be saved (orders to it are
 * pickup only). Saves to the customer's profile.
 */
export default function LocationPicker({
  initial,
  token,
  onSaved,
  saveLabel = 'Save location',
}: {
  initial: SavedLocation | null
  token: string | null
  onSaved: (loc: SavedLocation) => void
  saveLabel?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<LeafletMap | null>(null)
  const marker = useRef<Marker | null>(null)
  const [point, setPoint] = useState<Point | null>(
    initial?.deliveryLat != null && initial.deliveryLng != null ? { lat: initial.deliveryLat, lng: initial.deliveryLng } : null,
  )
  const [address, setAddress] = useState(initial?.deliveryAddress ?? '')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const town = point ? deliveryTownAt(point.lat, point.lng) : null

  // Build the map once. Leaflet needs the browser, so it's loaded here.
  useEffect(() => {
    let cancelled = false
    const start = point
    import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return
      const m = L.map(box.current, { scrollWheelZoom: false, attributionControl: true })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · ${BOUNDARY_CREDIT}`,
      }).addTo(m)

      const area = L.featureGroup(
        DELIVERY_TOWNS.flatMap((t) =>
          t.polygons.map((rings) =>
            L.polygon(
              rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
              { color: '#2f6b3a', weight: 1.5, dashArray: '4 4', fillColor: '#7fb069', fillOpacity: 0.12, interactive: false },
            ).bindTooltip(t.name, { sticky: true }),
          ),
        ),
      ).addTo(m)

      if (start) m.setView([start.lat, start.lng], 16)
      else m.fitBounds(area.getBounds(), { padding: [8, 8] })

      m.on('click', (e) => setPoint({ lat: e.latlng.lat, lng: e.latlng.lng }))
      map.current = m
      // The pin effect below may have run before the map existed.
      setPoint((p) => (p ? { ...p } : p))
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      marker.current = null
    }
    // Built once; the pin is kept in sync by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the pin where `point` says.
  useEffect(() => {
    const m = map.current
    if (!m || !point) return
    import('leaflet').then((L) => {
      if (!map.current) return
      if (!marker.current) {
        marker.current = L.marker([point.lat, point.lng], {
          draggable: true,
          keyboard: true,
          title: 'Delivery spot (drag to move)',
          icon: L.divIcon({ html: PIN_HTML, className: '', iconSize: [30, 40], iconAnchor: [15, 39] }),
        }).addTo(m)
        marker.current.on('dragend', () => {
          const ll = marker.current!.getLatLng()
          setPoint({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        marker.current.setLatLng([point.lat, point.lng])
      }
    })
    setSaved(false)
  }, [point])

  function useMyLocation() {
    setError('')
    if (!('geolocation' in navigator)) { setError("This browser can't share its location. Tap the map instead."); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPoint(p)
        map.current?.setView([p.lat, p.lng], 17)
      },
      (err) => {
        setLocating(false)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Allow it in your browser settings, or tap the map instead.'
            : "Couldn't find your location. Tap the map instead.",
        )
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  async function save() {
    if (!point) { setError('Tap the map to set a pin first'); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/users/me/location', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat: point.lat, lng: point.lng, address: address.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not save the location'); return }
      setSaved(true)
      onSaved(data)
    } catch {
      setError('Could not save the location')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">
        Farmers deliver only within <strong className="font-semibold text-soil">{DELIVERY_AREA_TEXT}</strong> (the shaded area). You can save a spot outside it, but orders to it will be pickup only.
      </p>

      <div className="relative isolate">
        <div ref={box} className="h-72 sm:h-80 w-full rounded-lg border border-gray-200 bg-field" aria-label="Map: tap to set your delivery spot" role="application" />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="absolute top-2 right-2 z-[1000] inline-flex items-center gap-1.5 bg-white/95 border border-gray-300 shadow-sm text-xs font-medium text-soil px-2.5 py-1.5 rounded-md hover:border-paddy disabled:opacity-60"
        >
          {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
          Use my location
        </button>
      </div>

      {point ? (
        town ? (
          <p className="flex items-center gap-1.5 text-sm text-paddy"><CheckCircle size={15} /> In {town}: delivery available</p>
        ) : (
          <p className="flex items-start gap-1.5 text-sm text-amber-700"><AlertTriangle size={15} className="shrink-0 mt-0.5" /> Outside the delivery area. You can save it, but orders to it will be pickup only.</p>
        )
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-gray-500"><MapPin size={15} /> Tap the map, or use your location, to set a pin.</p>
      )}

      <div>
        <label htmlFor="delivery-address" className="block text-sm font-medium text-gray-700 mb-1">House no., street, barangay, landmark</label>
        <textarea
          id="delivery-address"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setSaved(false) }}
          rows={2}
          maxLength={300}
          placeholder="e.g. 12 Rizal St., Brgy. Quinale, beside the chapel"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !point}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving…' : saveLabel}
        </button>
        {saved && <span className="flex items-center gap-1 text-sm text-paddy"><CheckCircle size={15} /> Saved</span>}
      </div>
    </div>
  )
}
