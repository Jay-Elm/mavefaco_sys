'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { LOG_TYPES, fmtDate } from '@/components/cropDisplay'
import type { AdvisoryGroup } from '@/lib/advisory'

const TYPE_TITLES: Record<string, string> = { pest_disease: 'Pest or disease', weather_impact: 'Weather impact', damage: 'Crop damage' }

/** Advisory groups, each one line that opens to its latest notes. */
export default function AdvisoryList({ groups, translations }: { groups: AdvisoryGroup[]; translations?: Record<number, string> }) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <ul className="divide-y divide-gray-100">
      {groups.map((g) => {
        const info = LOG_TYPES.find((t) => t.value === g.type) ?? LOG_TYPES[0]
        const Icon = info.icon
        const title = TYPE_TITLES[g.type] ?? g.type
        const isOpen = open === g.key
        return (
          <li key={g.key}>
            <button
              onClick={() => setOpen(isOpen ? null : g.key)}
              aria-expanded={isOpen}
              className="w-full flex items-start gap-3 py-2.5 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2"
            >
              <Icon size={15} className={`shrink-0 mt-0.5 ${info.cls}`} />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-medium text-soil">{title} on {g.cropType}</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  {g.farms} {g.farms === 1 ? 'farm' : 'farms'} · {g.reports} {g.reports === 1 ? 'report' : 'reports'}
                  {' '}· latest {fmtDate(g.latest)}
                </span>
              </span>
              {isOpen ? <ChevronDown size={15} className="shrink-0 text-gray-500 mt-0.5" /> : <ChevronRight size={15} className="shrink-0 text-gray-500 mt-0.5" />}
            </button>
            {isOpen && (
              <ul className="ml-7 mb-3 space-y-2">
                {g.notes.map((n) => (
                  <li key={n.id} className="text-sm text-gray-700">
                    {n.note}
                    <span className="text-xs text-gray-500 ml-2">{fmtDate(n.observedOn)}</span>
                    {translations?.[n.id] && (
                      <span className="block text-xs text-gray-600 mt-0.5"><span className="font-semibold">In English (AI):</span> {translations[n.id]}</span>
                    )}
                  </li>
                ))}
                {g.reports > g.notes.length && (
                  <li className="text-xs text-gray-500">and {g.reports - g.notes.length} earlier {g.reports - g.notes.length === 1 ? 'report' : 'reports'}</li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
