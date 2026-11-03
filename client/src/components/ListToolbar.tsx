'use client'

import { Search, X } from 'lucide-react'

export interface ToolbarSelect {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}

/**
 * Search box, filters and a "Sort by" menu above a list, with a count and
 * "Clear" when anything is filtered. Used on the farmer's lists.
 */
export default function ListToolbar({
  search,
  onSearch,
  placeholder,
  filters,
  sort,
  shown,
  total,
  noun,
  onClear,
}: {
  search: string
  onSearch: (value: string) => void
  placeholder: string
  filters: ToolbarSelect[]
  sort: ToolbarSelect
  shown: number
  total: number
  noun: string
  /** Called by "Clear"; shown only while a search or filter is on. */
  onClear?: () => void
}) {
  const select = 'px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-paddy'
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-paddy"
        />
      </div>
      {filters.map((f) => (
        <select key={f.label} aria-label={f.label} value={f.value} onChange={(e) => f.onChange(e.target.value)} className={select}>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        <span className="whitespace-nowrap">Sort by</span>
        <select value={sort.value} onChange={(e) => sort.onChange(e.target.value)} className={select}>
          {sort.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      {onClear && (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-soil underline">
          <X size={12} aria-hidden /> Clear
        </button>
      )}
      <span className="ml-auto text-xs text-gray-600 tabular">
        {shown === total ? `${total} ${total === 1 ? noun.replace(/s$/, '') : noun}` : `${shown} of ${total} ${noun}`}
      </span>
    </div>
  )
}
