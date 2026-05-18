'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, Droplets, Thermometer, Loader2 } from 'lucide-react'

interface WeatherData {
  temperature: number
  humidity: number
  windSpeed: number
  code: number
}

function getWeatherInfo(code: number): { label: string; Icon: React.ElementType; color: string } {
  if (code === 0)                     return { label: 'Clear Sky',        Icon: Sun,            color: 'text-amber-500' }
  if (code <= 3)                      return { label: 'Partly Cloudy',    Icon: Cloud,          color: 'text-gray-400' }
  if (code <= 48)                     return { label: 'Foggy',            Icon: Cloud,          color: 'text-gray-500' }
  if (code <= 67)                     return { label: 'Rainy',            Icon: CloudRain,      color: 'text-blue-500' }
  if (code <= 77)                     return { label: 'Snow',             Icon: CloudSnow,      color: 'text-blue-200' }
  if (code <= 82)                     return { label: 'Rain Showers',     Icon: CloudRain,      color: 'text-blue-600' }
  if (code >= 95)                     return { label: 'Thunderstorm',     Icon: CloudLightning, color: 'text-purple-600' }
  return                                     { label: 'Cloudy',           Icon: Cloud,          color: 'text-gray-400' }
}

// Legazpi City, Albay — coordinates
const LAT = 13.1391
const LON = 123.7438

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

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center justify-center h-28">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  )

  if (error || !weather) return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 text-xs text-gray-400 text-center h-28 flex items-center justify-center">
      Weather unavailable
    </div>
  )

  const { label, Icon, color } = getWeatherInfo(weather.code)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Weather · Legazpi City, Albay
      </p>
      <div className="flex items-center gap-4">
        <Icon size={36} className={color} />
        <div>
          <p className="text-3xl font-bold text-gray-900">{weather.temperature}°C</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
        <div className="ml-auto space-y-1 text-xs text-gray-500 text-right">
          <p className="flex items-center gap-1 justify-end">
            <Droplets size={12} className="text-blue-400" /> {weather.humidity}% humidity
          </p>
          <p className="flex items-center gap-1 justify-end">
            <Wind size={12} className="text-gray-400" /> {weather.windSpeed} km/h wind
          </p>
          <p className="flex items-center gap-1 justify-end">
            <Thermometer size={12} className="text-red-400" /> Feels tropical
          </p>
        </div>
      </div>
    </div>
  )
}
