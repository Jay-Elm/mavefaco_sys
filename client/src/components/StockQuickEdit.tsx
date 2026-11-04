'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { fmtQty, numericText, stockError, unitStep } from '@/lib/units'

/**
 * A listing's stock with a pencil to change it in place. Stock changes go
 * live at once (they don't send the listing back for review). Whole numbers
 * for counted units, steps of 0.25 for kg and liters, as everywhere else.
 */
export default function StockQuickEdit({
  stock,
  unit,
  badge,
  onSave,
}: {
  stock: number
  unit: string
  /** How the stock reads when not editing (the low / out-of-stock badge). */
  badge: ReactNode
  /** Saves the new stock; resolves to an error message, or null when saved. */
  onSave: (stock: number) => Promise<string | null>
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const decimals = unitStep(unit) < 1

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  function start() {
    setValue(fmtQty(stock))
    setError('')
    setEditing(true)
  }

  async function save() {
    const n = Number(value)
    if (value.trim() === '' || !Number.isFinite(n) || n < 0) { setError('Enter 0 or more'); return }
    const bad = stockError(n, unit) ?? (decimals && Math.round(n * 4) !== n * 4 ? `Use steps of 0.25 ${unit}` : null)
    if (bad) { setError(bad); return }
    if (n === stock) { setEditing(false); return }
    setSaving(true)
    const err = await onSave(n)
    setSaving(false)
    if (err) { setError(err); return }
    setEditing(false)
  }

  if (!editing)
    return (
      <span className="inline-flex items-center gap-1.5">
        {badge}
        <button
          type="button"
          onClick={start}
          aria-label={`Change stock (now ${fmtQty(stock)} ${unit})`}
          title="Change stock"
          className="p-1 rounded text-gray-400 hover:text-paddy hover:bg-shoot transition-colors"
        >
          <Pencil size={12} />
        </button>
      </span>
    )

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <span className="inline-flex items-center gap-1">
        <input
          ref={input}
          type="text"
          inputMode={decimals ? 'decimal' : 'numeric'}
          autoComplete="off"
          aria-label={`New stock in ${unit}`}
          value={value}
          onChange={(e) => { setValue(numericText(e.target.value, decimals)); setError('') }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); void save() }
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-20 px-2 py-1 text-sm text-center border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-paddy"
        />
        <span className="text-xs text-gray-500">{unit}</span>
        <button type="button" onClick={save} disabled={saving} aria-label="Save stock" className="p-1 rounded text-paddy hover:bg-shoot disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} aria-label="Cancel" className="p-1 rounded text-gray-500 hover:bg-gray-100">
          <X size={14} />
        </button>
      </span>
      {error && <span role="alert" className="text-[11px] text-red-600 max-w-44">{error}</span>}
    </span>
  )
}
