// Shared labels and styles for the Crop Monitor pages.
import { Bug, CloudRain, FileText, Flame } from 'lucide-react'
import type { ElementType } from 'react'

export interface CropType {
  id: number
  name: string
  daysToHarvestMin: number
  daysToHarvestMax: number
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
  attention: 'harvest-now' | 'overdue' | null
  progress: number | null
  day: number
}

export interface CropLog {
  id: number
  type: string
  note: string
  observedOn: string
}

export const STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  growing:   { label: 'Growing',   cls: 'bg-shoot text-paddy' },
  harvested: { label: 'Harvested', cls: 'bg-gray-100 text-gray-700' },
  failed:    { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
}

/** The badge a planting shows: where a growing one stands against its harvest window, else its status. */
export function plantingBadge(p: Pick<Planting, 'status' | 'attention'>): { label: string; cls: string } {
  if (p.status !== 'growing') return STATUS_STYLES[p.status]
  if (p.attention === 'overdue') return { label: 'Overdue', cls: 'bg-red-100 text-red-700' }
  if (p.attention === 'harvest-now') return { label: 'Ready to harvest', cls: 'bg-amber-100 text-amber-800' }
  return STATUS_STYLES.growing
}

export const LOG_TYPES: { value: string; label: string; icon: ElementType; cls: string }[] = [
  { value: 'pest_disease',   label: 'Pest / Disease', icon: Bug,       cls: 'text-red-600' },
  { value: 'weather_impact', label: 'Weather Impact', icon: CloudRain, cls: 'text-blue-600' },
  { value: 'damage',         label: 'Crop Damage',    icon: Flame,     cls: 'text-orange-600' },
  { value: 'note',           label: 'General Note',   icon: FileText,  cls: 'text-gray-600' },
]

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
