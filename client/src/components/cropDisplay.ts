// Shared labels and styles for the Crop Monitor pages.
import { Bug, CloudRain, FileText, Flame } from 'lucide-react'
import type { ElementType } from 'react'

export interface CropType {
  id: number
  name: string
  daysToHarvestMin: number
  daysToHarvestMax: number
  vegetativeDay: number
  floweringDay: number | null
  fruitingDay: number | null
}

export interface Planting {
  id: number
  plantedOn: string
  harvestStart: string
  harvestEnd: string
  areaSqm: number | null
  expectedYield: number | null
  status: 'growing' | 'harvested' | 'failed'
  harvestedOn: string | null
  actualYield: number | null
  cropType: CropType
  product: { id: number; name: string; unit: string; archivedAt: string | null } | null
  stage: string | null
  attention: 'harvest-now' | 'overdue' | null
  progress: number | null
  day: number
}

export interface CropLog {
  id: number
  type: string
  note: string
  observedOn: string
  severity: string | null
  pest: string | null
}

export const STAGE_STYLES: Record<string, { label: string; cls: string }> = {
  seedling:        { label: 'Seedling',      cls: 'bg-lime-100 text-lime-700' },
  vegetative:      { label: 'Vegetative',    cls: 'bg-shoot text-paddy' },
  flowering:       { label: 'Flowering',     cls: 'bg-pink-100 text-pink-700' },
  fruiting:        { label: 'Fruiting',      cls: 'bg-orange-100 text-orange-700' },
  'harvest-ready': { label: 'Harvest ready', cls: 'bg-amber-100 text-amber-800' },
}

export const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  growing:   { label: 'Growing',   cls: 'bg-shoot text-paddy' },
  harvested: { label: 'Harvested', cls: 'bg-gray-100 text-gray-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
}

export const LOG_TYPES: { value: string; label: string; icon: ElementType; cls: string }[] = [
  { value: 'pest_disease',   label: 'Pest / Disease', icon: Bug,       cls: 'text-red-600' },
  { value: 'weather_impact', label: 'Weather Impact', icon: CloudRain, cls: 'text-blue-600' },
  { value: 'damage',         label: 'Crop Damage',    icon: Flame,     cls: 'text-orange-600' },
  { value: 'note',           label: 'General Note',   icon: FileText,  cls: 'text-gray-600' },
]

export const SEVERITY_STYLES: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-800' },
  high:   { label: 'High',   cls: 'bg-red-100 text-red-700' },
}

/** A "YYYY-MM-DD" calendar date for display, e.g. "Oct 26, 2026". */
export const fmtDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }) : '—'

/** A harvest window, e.g. "Oct 26 – Nov 9, 2026". */
export function fmtWindow(start: string, end: string) {
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const
  const s = new Date(`${start}T00:00:00Z`)
  const e = new Date(`${end}T00:00:00Z`)
  const year = e.toLocaleDateString('en-PH', { year: 'numeric', timeZone: 'UTC' })
  return `${s.toLocaleDateString('en-PH', opts)} – ${e.toLocaleDateString('en-PH', opts)}, ${year}`
}

export const fmtKg = (n: number | null) =>
  n === null ? '—' : `${n.toLocaleString('en-PH', { maximumFractionDigits: 1 })} kg`

export const INPUT =
  'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy'
