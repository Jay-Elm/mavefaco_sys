'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import type { FeatureGroup, Map as LeafletMap, Marker, TileLayer } from 'leaflet'
import { AlertTriangle, CheckCircle, Crosshair, Loader2, MapPin, Maximize2, Minimize2 } from 'lucide-react'
import { BOUNDARY_CREDIT, DELIVERY_AREA_TEXT, DELIVERY_TOWNS, deliveryTownAt } from '@/lib/deliveryArea'

export interface SavedLocation {
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryAddress: string | null
  deliveryTown: string | null
}

type Point = { lat: number; lng: number }
type View = 'street' | 'satellite'

const OSM_CREDIT = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// Esri World Imagery: free satellite photos, credited on the map.
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const SATELLITE_CREDIT = 'Imagery &copy; Esri, Maxar, Earthstar Geographics'

// A plain SVG pin (no image files to load, nothing from the user in it).
const PIN_HTML =
  '<svg width="30" height="40" viewBox="0 0 30 40" aria-hidden="true"><path d="M15 39s13-13.4 13-24A13 13 0 0 0 2 15c0 10.6 13 24 13 24z" fill="#2f6b3a" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>'

const MAP_BTN = 'inline-flex items-center gap-1.5 h-9 bg-white/95 border border-gray-300 shadow-sm text-xs font-medium text-soil rounded-md hover:border-paddy disabled:opacity-60'

/**
 * Pick a delivery spot: tap the map or drag the pin, or use the phone's
 * location, then add house/street/landmark details. The delivery area is
 * drawn on the map; a spot outside it can still be saved (orders to it are
 * pickup only). Saves to the customer's profile.
 */
// Positions less precise than this (metres) get the "rough location" message.
const ROUGH_ACCURACY_M = 1000

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
  const layers = useRef<Record<View, TileLayer> | null>(null)
  const area = useRef<FeatureGroup | null>(null)
  const [view, setView] = useState<View>('street')
  const [full, setFull] = useState(false)
  const [point, setPoint] = useState<Point | null>(
    initial?.deliveryLat != null && initial.deliveryLng != null ? { lat: initial.deliveryLat, lng: initial.deliveryLng } : null,
  )
  const [address, setAddress] = useState(initial?.deliveryAddress ?? '')
  const [locating, setLocating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Set when the device gave only a rough position (no GPS); cleared once the pin is moved by hand.
  const [rough, setRough] = useState(false)
  const [saved, setSaved] = useState(false)
  const town = point ? deliveryTownAt(point.lat, point.lng) : null

  // Build the map once. Leaflet needs the browser, so it's loaded here.
  useEffect(() => {
    let cancelled = false
    const start = point
    import('leaflet').then((L) => {
      if (cancelled || !box.current || map.current) return
      // The wheel and a pinch zoom the map itself, not the page.
      const m = L.map(box.current, { scrollWheelZoom: true, touchZoom: true, attributionControl: true })
      layers.current = {
        street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: `${OSM_CREDIT} · ${BOUNDARY_CREDIT}`,
        }),
        satellite: L.tileLayer(SATELLITE_URL, {
          maxZoom: 19,
          attribution: `${SATELLITE_CREDIT} · ${BOUNDARY_CREDIT}`,
        }),
      }
      layers.current.street.addTo(m)

      const shaded = L.featureGroup(
        DELIVERY_TOWNS.flatMap((t) =>
          t.polygons.map((rings) =>
            L.polygon(
              rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
              { color: '#2f6b3a', weight: 1.5, dashArray: '4 4', fillColor: '#7fb069', fillOpacity: 0.12, interactive: false },
            ).bindTooltip(t.name, { sticky: true }),
          ),
        ),
      ).addTo(m)
      area.current = shaded

      if (start) m.setView([start.lat, start.lng], 16)
      else m.fitBounds(shaded.getBounds(), { padding: [8, 8] })

      m.on('click', (e) => { setRough(false); setPoint({ lat: e.latlng.lat, lng: e.latlng.lng }) })
      map.current = m
      // The pin effect below may have run before the map existed.
      setPoint((p) => (p ? { ...p } : p))
    })
    return () => {
      cancelled = true
      map.current?.remove()
      map.current = null
      marker.current = null
      layers.current = null
      area.current = null
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
          setRough(false)
          setPoint({ lat: ll.lat, lng: ll.lng })
        })
      } else {
        marker.current.setLatLng([point.lat, point.lng])
      }
    })
    setSaved(false)
  }, [point])

  // Street map or satellite photos.
  useEffect(() => {
    const m = map.current
    const l = layers.current
    if (!m || !l) return
    const other = view === 'street' ? 'satellite' : 'street'
    if (m.hasLayer(l[other])) m.removeLayer(l[other])
    if (!m.hasLayer(l[view])) l[view].addTo(m)
    // Dark green disappears on the photos; yellow stands out there.
    area.current?.setStyle(view === 'satellite'
      ? { color: '#facc15', fillColor: '#facc15', fillOpacity: 0.12 }
      : { color: '#2f6b3a', fillColor: '#7fb069', fillOpacity: 0.12 })
  }, [view])

  // Full screen: the map fills the window; Esc closes it. Leaflet has to
  // measure its box again after the size changes.
  useEffect(() => {
    map.current?.invalidateSize()
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = overflow
      window.removeEventListener('keydown', onKey)
    }
  }, [full])

  function useMyLocation() {
    setError('')
    setRough(false)
    if (!('geolocation' in navigator)) { setError("This browser can't share its location. Tap the map instead."); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPoint(p)
        // Without GPS, browsers guess from Wi-Fi or the internet address, which can be kilometres off.
        const rough = pos.coords.accuracy > ROUGH_ACCURACY_M
        setRough(rough)
        map.current?.setView([p.lat, p.lng], rough ? 14 : 17)
      },
      (err) => {
        setLocating(false)
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was blocked. Allow it in your browser settings, or tap the map instead.'
            : "Couldn't find your location. Turn on your device's location (GPS) and try again, or tap the map.",
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

      <div className={full ? 'fixed inset-0 z-[2000] bg-white p-2 sm:p-4 isolate' : 'relative isolate'}>
        {/* The size lives on this wrapper: Leaflet adds its own classes to the
            map box, and changing the box's className would wipe them. */}
        <div className={full ? 'h-full' : 'h-72 sm:h-80'}>
          <div
            ref={box}
            className="map-roomy h-full w-full rounded-lg border border-gray-200 bg-field"
            aria-label="Map: tap to set your delivery spot"
            role="application"
          />
        </div>
        <div className={`absolute z-[1000] flex items-start gap-1.5 ${full ? 'top-4 right-4 sm:top-6 sm:right-6' : 'top-2 right-2'}`}>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className={`${MAP_BTN} px-2.5`}
          >
            {locating ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
            Use my location
          </button>
          <button
            type="button"
            onClick={() => setFull((f) => !f)}
            aria-label={full ? 'Close full screen' : 'Full screen map'}
            title={full ? 'Close full screen (Esc)' : 'Full screen map'}
            className={`${MAP_BTN} w-9 justify-center`}
          >
            {full ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
        <div
          role="group"
          aria-label="Map type"
          className={`absolute z-[1000] inline-flex overflow-hidden rounded-md border border-gray-300 bg-white/95 shadow-sm text-xs font-medium ${full ? 'bottom-10 left-4 sm:left-6' : 'bottom-11 left-2'}`}
        >
          {(['street', 'satellite'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-2 ${view === v ? 'bg-paddy text-white' : 'text-soil hover:bg-gray-100'}`}
            >
              {v === 'street' ? 'Street' : 'Satellite'}
            </button>
          ))}
        </div>
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
      {rough && (
        <p role="status" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Your device only gave a rough location. Turn on your device&apos;s location (GPS) for a better one, or move the pin to your exact spot.
        </p>
      )}

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
