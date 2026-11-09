'use client'

import { CalendarDays, Droplets, Loader2, Umbrella } from 'lucide-react'
import { dayLabel, describeWeather, isRainy, rainOutlook, FORECAST_DAYS } from '@/lib/weather'
import { todayPH } from '@/lib/planting'
import { useWeather, WEATHER_ICONS } from '@/components/weather/useWeather'

/** The next seven days in Tabaco City, with a line on the rain ahead. */
export default function WeatherForecast({ className = '' }: { className?: string }) {
  const { weather, state } = useWeather()
  const today = todayPH()

  return (
    <section aria-labelledby="forecast-h" className={`bg-white rounded-lg border border-gray-200 shadow-sm p-5 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h2 id="forecast-h" className="flex items-center gap-2 text-base font-semibold text-soil">
          <CalendarDays size={17} className="text-paddy" aria-hidden /> {FORECAST_DAYS}-day forecast
        </h2>
        <p className="text-xs text-gray-500">Tabaco City, Albay · from Open-Meteo</p>
      </div>

      {state === 'loading' && (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
      )}
      {(state === 'error' || (state === 'ready' && (!weather || weather.days.length === 0))) && (
        <p className="text-sm text-gray-500 py-4">The forecast is unavailable right now. Try again later.</p>
      )}

      {state === 'ready' && weather && weather.days.length > 0 && (
        <>
          <ol className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {weather.days.map((d) => {
              const { label, kind } = describeWeather(d.code)
              const { Icon, color } = WEATHER_ICONS[kind]
              const rainy = isRainy(d)
              return (
                <li
                  key={d.date}
                  className={`rounded-lg border px-2 py-2.5 text-center ${rainy ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <p className="text-xs font-semibold text-soil">{dayLabel(d.date, today)}</p>
                  <Icon size={22} className={`${color} mx-auto my-1.5`} aria-hidden />
                  <span className="sr-only">{label}. </span>
                  <p className="text-xs sm:text-sm text-soil tabular whitespace-nowrap">
                    <span className="font-semibold">{d.max}°</span>
                    <span className="text-gray-500"> / {d.min}°</span>
                  </p>
                  {d.rainChance !== null && (
                    <p className={`mt-1 inline-flex items-center gap-0.5 text-xs tabular ${rainy ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                      <Droplets size={11} aria-hidden />
                      <span className="sr-only">Chance of rain </span>{d.rainChance}%
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
          <p className="mt-3 flex items-start gap-2 text-sm text-gray-700">
            <Umbrella size={15} className="text-blue-600 shrink-0 mt-0.5" aria-hidden />
            {rainOutlook(weather.days, today) ?? 'No rain likely in the next seven days.'}
          </p>
        </>
      )}
    </section>
  )
}
