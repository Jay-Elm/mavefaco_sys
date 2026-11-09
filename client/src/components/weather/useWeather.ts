'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun } from 'lucide-react'
import { WEATHER_URL, parseWeather, type Weather, type WeatherKind } from '@/lib/weather'

// One request shared by every weather card on the page, reused for 10 minutes.
const TTL_MS = 10 * 60 * 1000
let cached: { at: number; promise: Promise<Weather> } | null = null

function loadWeather(): Promise<Weather> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.promise
  const promise = fetch(WEATHER_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`Weather service answered ${r.status}`)
      return r.json()
    })
    .then(parseWeather)
  cached = { at: Date.now(), promise }
  promise.catch(() => { cached = null }) // try again next time
  return promise
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    loadWeather()
      .then((w) => { if (alive) { setWeather(w); setState('ready') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [])

  return { weather, state }
}

export const WEATHER_ICONS: Record<WeatherKind, { Icon: React.ElementType; color: string }> = {
  clear:   { Icon: Sun,            color: 'text-amber-500' },
  cloudy:  { Icon: Cloud,          color: 'text-gray-500' },
  fog:     { Icon: CloudFog,       color: 'text-gray-500' },
  rain:    { Icon: CloudRain,      color: 'text-blue-500' },
  showers: { Icon: CloudRain,      color: 'text-blue-600' },
  thunder: { Icon: CloudLightning, color: 'text-purple-600' },
  snow:    { Icon: CloudSnow,      color: 'text-blue-200' },
}
