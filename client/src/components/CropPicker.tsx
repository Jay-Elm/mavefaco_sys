'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { searchCrops, type NamedCrop } from '@/lib/cropKeywords'

export interface PickerCrop extends NamedCrop {
  category?: string
}

/** The value of a picker: '' (none chosen), 'none' (not a farm crop), or a crop id. */
export type CropValue = string

/**
 * A searchable crop list: type any name, English, Filipino or Bikol
 * ("talong" finds Eggplant). Shows every crop, grouped by category, when
 * the box is empty. Keyboard: arrows to move, Enter to choose, Escape to close.
 */
export default function CropPicker({
  crops,
  value,
  onChange,
  label,
  emptyLabel = 'Choose a crop',
  allowNotACrop = false,
  allowEmpty = false,
  required = false,
  compact = false,
}: {
  crops: PickerCrop[]
  value: CropValue
  onChange: (value: CropValue) => void
  label: string
  emptyLabel?: string
  allowNotACrop?: boolean
  allowEmpty?: boolean
  required?: boolean
  compact?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const selected = crops.find((c) => String(c.id) === value)
  const shown = value === 'none' ? 'Not a farm crop' : selected?.name ?? ''

  const options = useMemo(() => {
    const found = searchCrops(query, crops)
    const extra: { key: string; label: string; hint?: string }[] = []
    if (allowEmpty && !query) extra.push({ key: '', label: emptyLabel })
    if (allowNotACrop && (!query || 'not a farm crop'.includes(query.toLowerCase())))
      extra.push({ key: 'none', label: 'Not a farm crop', hint: 'processed goods, fish, and other things no crop matches' })
    return [
      ...extra,
      ...found.map(({ crop, via }) => ({ key: String(crop.id), label: crop.name, hint: via ? `also called ${via}` : undefined, category: crop.category })),
    ] as { key: string; label: string; hint?: string; category?: string }[]
  }, [query, crops, allowEmpty, allowNotACrop, emptyLabel])

  function choose(key: string) {
    onChange(key)
    setOpen(false)
    setQuery('')
  }

  const listId = `${id}-list`
  return (
    <div className="relative">
      {!compact && <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={compact ? label : undefined}
          aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
          required={required && !value}
          autoComplete="off"
          placeholder={shown || (allowEmpty ? emptyLabel : 'Type to search, e.g. talong')}
          value={open ? query : shown}
          onFocus={() => { setOpen(true); setQuery(''); setActive(0) }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, options.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
            else if (e.key === 'Enter' && open && options[active]) { e.preventDefault(); choose(options[active].key) }
            else if (e.key === 'Escape') { setOpen(false); input.current?.blur() }
          }}
          className={`w-full pl-8 pr-8 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy ${compact ? 'py-1.5' : 'py-2'} ${!open && shown ? 'placeholder:text-soil' : ''}`}
        />
        {value && allowEmpty ? (
          <button type="button" onClick={() => choose('')} aria-label="Clear crop" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700"><X size={14} /></button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden />
        )}
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm">
          {options.length === 0 && <li className="px-3 py-2 text-gray-500">No crop matches “{query}”</li>}
          {options.map((o, i) => {
            const heading = !query && o.category && o.category !== options[i - 1]?.category
            return (
              <li key={o.key || 'empty'} role="presentation">
                {heading && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{o.category}</p>}
                <div
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.key === value}
                  onMouseDown={(e) => { e.preventDefault(); choose(o.key) }}
                  onMouseEnter={() => setActive(i)}
                  className={`px-3 py-1.5 cursor-pointer ${i === active ? 'bg-shoot/60' : ''} ${o.key === value ? 'font-semibold text-paddy-deep' : 'text-soil'}`}
                >
                  {o.label}
                  {o.hint && <span className="ml-1.5 text-xs text-gray-500">{o.hint}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
