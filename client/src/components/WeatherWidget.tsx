'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, Droplets, Loader2 } from 'lucide-react'

interface WeatherData {
  temperature: number
  humidity: number
  windSpeed: number
  code: number
}

function getWeatherInfo(code: number): { label: string; Icon: React.ElementType; color: string } {
  if (code === 0)                     return { label: 'Clear Sky',        Icon: Sun,            color: 'text-amber-500' }
  if (code <= 3)                      return { label: 'Partly Cloudy',    Icon: Cloud,          color: 'text-gray-500' }
  if (code <= 48)                     return { label: 'Foggy',            Icon: Cloud,          color: 'text-gray-500' }
  if (code <= 67)                     return { label: 'Rainy',            Icon: CloudRain,      color: 'text-blue-500' }
  if (code <= 77)                     return { label: 'Snow',             Icon: CloudSnow,      color: 'text-blue-200' }
  if (code <= 82)                     return { label: 'Rain Showers',     Icon: CloudRain,      color: 'text-blue-600' }
  if (code >= 95)                     return { label: 'Thunderstorm',     Icon: CloudLightning, color: 'text-purple-600' }
  return                                     { label: 'Cloudy',           Icon: Cloud,          color: 'text-gray-500' }
}

// Tabaco City, Albay — coordinates
const LAT = 13.3594
const LON = 123.7331

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
      `&timezone=Asia%2FManila`,
    )
      .then((r) => r.json())
      .then((d) => {
        const c = d.current
        setWeather({
          temperature: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          windSpeed: Math.round(c.wind_speed_10m),
          code: c.weather_code,
        })
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // A light, see-through card that sits over the sand like an overlay.
  const card = 'rounded-card border border-white/70 bg-white/45 backdrop-blur-sm shadow-card'

  if (loading) return (
    <div className={`${card} px-4 py-3 flex items-center justify-center h-[76px] w-full sm:w-80`}>
      <Loader2 size={18} className="animate-spin text-gray-500" />
    </div>
  )

  if (error || !weather) return (
    <div className={`${card} px-4 py-3 text-xs text-gray-600 flex items-center justify-center h-[76px] w-full sm:w-80`}>
      Weather unavailable
    </div>
  )

  const { label, Icon, color } = getWeatherInfo(weather.code)

  return (
    <section aria-label="Weather in Tabaco City, Albay" className={`${card} px-4 py-3 flex items-center gap-3 w-full sm:w-auto`}>
      <Icon size={32} className={`${color} shrink-0`} aria-hidden />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold leading-none text-soil tabular">{weather.temperature}°C</span>
          <span className="text-sm text-soil/80">{label}</span>
        </p>
        <p className="mt-1 text-xs text-soil/70">Tabaco City, Albay</p>
      </div>
      <div className="ml-auto sm:ml-4 pl-4 border-l border-soil/10 space-y-1 text-xs text-soil/75 whitespace-nowrap">
        <p className="flex items-center gap-1"><Droplets size={12} className="text-blue-500" aria-hidden /> {weather.humidity}% humidity</p>
        <p className="flex items-center gap-1"><Wind size={12} className="text-gray-500" aria-hidden /> {weather.windSpeed} km/h wind</p>
      </div>
    </section>
  )
}
