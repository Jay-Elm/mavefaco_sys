'use client'

import { Wind, Droplets, Loader2 } from 'lucide-react'
import { describeWeather } from '@/lib/weather'
import { useWeather, WEATHER_ICONS } from '@/components/weather/useWeather'

/** Current weather in Tabaco City, for the farmer's overview header. */
export default function WeatherWidget() {
  const { weather, state } = useWeather()

  // A light, see-through card that sits over the sand like an overlay.
  const card = 'rounded-card border border-white/70 bg-white/45 backdrop-blur-sm shadow-card'

  if (state === 'loading') return (
    <div className={`${card} px-4 py-3 flex items-center justify-center h-[76px] w-full sm:w-80`}>
      <Loader2 size={18} className="animate-spin text-gray-500" />
    </div>
  )

  if (state === 'error' || !weather) return (
    <div className={`${card} px-4 py-3 text-xs text-gray-600 flex items-center justify-center h-[76px] w-full sm:w-80`}>
      Weather unavailable
    </div>
  )

  const now = weather.current
  const { label, kind } = describeWeather(now.code)
  const { Icon, color } = WEATHER_ICONS[kind]

  return (
    <section aria-label="Weather in Tabaco City, Albay" className={`${card} px-4 py-3 flex items-center gap-3 w-full sm:w-auto`}>
      <Icon size={32} className={`${color} shrink-0`} aria-hidden />
      <div className="min-w-0">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold leading-none text-soil tabular">{now.temperature}°C</span>
          <span className="text-sm text-soil/80">{label}</span>
        </p>
        <p className="mt-1 text-xs text-soil/70">Tabaco City, Albay</p>
      </div>
      <div className="ml-auto sm:ml-4 pl-4 border-l border-soil/10 space-y-1 text-xs text-soil/75 whitespace-nowrap">
        <p className="flex items-center gap-1"><Droplets size={12} className="text-blue-500" aria-hidden /> {now.humidity}% humidity</p>
        <p className="flex items-center gap-1"><Wind size={12} className="text-gray-500" aria-hidden /> {now.windSpeed} km/h wind</p>
      </div>
    </section>
  )
}
