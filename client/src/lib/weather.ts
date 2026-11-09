/**
 * Weather for Tabaco City from Open-Meteo (free, no key), fetched by the
 * browser. Current conditions plus a 7-day forecast, in Philippine time.
 */

// Tabaco City, Albay
export const TABACO = { lat: 13.3594, lon: 123.7331 }
export const FORECAST_DAYS = 7

/** A day whose chance of rain reaches this is called a rainy day. */
export const RAIN_LIKELY_PCT = 60
/** This much rain in a day (mm) is called heavy. */
export const HEAVY_RAIN_MM = 20

export const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${TABACO.lat}&longitude=${TABACO.lon}` +
  `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum` +
  `&forecast_days=${FORECAST_DAYS}&timezone=Asia%2FManila`

export interface CurrentWeather {
  temperature: number
  humidity: number
  windSpeed: number
  code: number
}

export interface ForecastDay {
  date: string // YYYY-MM-DD, Philippine time
  code: number
  max: number
  min: number
  rainChance: number | null // percent
  rainMm: number | null
}

export interface Weather {
  current: CurrentWeather
  days: ForecastDay[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Reads Open-Meteo's answer; throws when the current conditions are missing. */
export function parseWeather(d: unknown): Weather {
  const data = d as { current?: Record<string, unknown>; daily?: Record<string, unknown[]> }
  const c = data?.current
  const temperature = num(c?.temperature_2m)
  const code = num(c?.weather_code)
  if (temperature === null || code === null) throw new Error('No current weather in the response')
  const current = {
    temperature: Math.round(temperature),
    humidity: Math.round(num(c?.relative_humidity_2m) ?? 0),
    windSpeed: Math.round(num(c?.wind_speed_10m) ?? 0),
    code,
  }

  const daily = data.daily ?? {}
  const dates = Array.isArray(daily.time) ? daily.time : []
  const days: ForecastDay[] = []
  dates.forEach((date, i) => {
    const max = num(daily.temperature_2m_max?.[i])
    const min = num(daily.temperature_2m_min?.[i])
    const dayCode = num(daily.weather_code?.[i])
    if (typeof date !== 'string' || max === null || min === null || dayCode === null) return
    const rainMm = num(daily.precipitation_sum?.[i])
    days.push({
      date,
      code: dayCode,
      max: Math.round(max),
      min: Math.round(min),
      rainChance: num(daily.precipitation_probability_max?.[i]),
      rainMm: rainMm === null ? null : Math.round(rainMm * 10) / 10,
    })
  })
  return { current, days }
}

export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'showers' | 'thunder' | 'snow'

/** WMO weather code → a plain label and kind. */
export function describeWeather(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: 'Clear sky', kind: 'clear' }
  if (code <= 3) return { label: 'Partly cloudy', kind: 'cloudy' }
  if (code <= 48) return { label: 'Foggy', kind: 'fog' }
  if (code <= 67) return { label: 'Rainy', kind: 'rain' }
  if (code <= 77) return { label: 'Snow', kind: 'snow' }
  if (code <= 82) return { label: 'Rain showers', kind: 'showers' }
  if (code >= 95) return { label: 'Thunderstorm', kind: 'thunder' }
  return { label: 'Cloudy', kind: 'cloudy' }
}

export const isRainy = (d: ForecastDay) => (d.rainChance ?? 0) >= RAIN_LIKELY_PCT || (d.rainMm ?? 0) >= HEAVY_RAIN_MM
export const isHeavyRain = (d: ForecastDay) => (d.rainMm ?? 0) >= HEAVY_RAIN_MM

/** "Today", "Tomorrow" or the short weekday ("Wed") of a forecast date. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today'
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (date === tomorrow.toISOString().slice(0, 10)) return 'Tomorrow'
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'UTC' })
}

/**
 * One sentence on the rain ahead, for planning harvests and field work,
 * or null when the week looks dry.
 */
export function rainOutlook(days: ForecastDay[], today: string): string | null {
  const rainy = days.filter(isRainy)
  if (rainy.length === 0) return null
  const names = (list: ForecastDay[]) => list.map((d) => dayLabel(d.date, today)).join(', ')
  const heavy = rainy.filter(isHeavyRain)
  return (
    `Rain likely: ${names(rainy)}.` +
    (heavy.length > 0 ? ` Heavy rain (${HEAVY_RAIN_MM} mm or more): ${names(heavy)}.` : '') +
    ' Plan harvests and drying around it.'
  )
}
