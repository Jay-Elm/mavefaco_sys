'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/contexts/DialogContext'
import { AlertCircle, Check, Loader2, Pencil, Plus, Sprout, Trash2, X } from 'lucide-react'
import type { CropType } from '@/components/cropDisplay'

type Row = CropType & { _count: { plantings: number } }
type Form = { name: string; daysToHarvestMin: string; daysToHarvestMax: string; vegetativeDay: string; floweringDay: string; fruitingDay: string }

const EMPTY: Form = { name: '', daysToHarvestMin: '', daysToHarvestMax: '', vegetativeDay: '', floweringDay: '', fruitingDay: '' }
const CELL_INPUT = 'w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

const toForm = (c: CropType): Form => ({
  name: c.name,
  daysToHarvestMin: String(c.daysToHarvestMin),
  daysToHarvestMax: String(c.daysToHarvestMax),
  vegetativeDay: String(c.vegetativeDay),
  floweringDay: c.floweringDay === null ? '' : String(c.floweringDay),
  fruitingDay: c.fruitingDay === null ? '' : String(c.fruitingDay),
})
const toBody = (f: Form) => ({
  name: f.name.trim(),
  daysToHarvestMin: Number(f.daysToHarvestMin),
  daysToHarvestMax: Number(f.daysToHarvestMax),
  vegetativeDay: Number(f.vegetativeDay),
  floweringDay: f.floweringDay === '' ? null : Number(f.floweringDay),
  fruitingDay: f.fruitingDay === '' ? null : Number(f.fruitingDay),
})

export default function CropTypesPage() {
  const { token } = useAuth()
  const dialog = useDialog()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(EMPTY)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Form>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/crop-types', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setRows(d)))
      .catch(() => setError('Failed to load crop types'))
      .finally(() => setLoading(false))
  }, [token])

  const request = (path: string, method: string, body?: unknown) =>
    fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(async (r) => ({ ok: r.ok, data: await r.json() }))

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true); setAddError('')
    try {
      const { ok, data } = await request('/api/crop-types', 'POST', toBody(form))
      if (!ok) { setAddError(data.error); return }
      setRows((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(EMPTY)
    } catch {
      setAddError('Failed to add crop type')
    } finally {
      setAdding(false)
    }
  }

  async function saveEdit(id: number) {
    setSaving(true)
    try {
      const { ok, data } = await request(`/api/crop-types/${id}`, 'PUT', toBody(editForm))
      if (!ok) { await dialog.alert({ title: "Couldn't save the crop", message: data.error }); return }
      setRows((prev) => prev.map((r) => (r.id === id ? data : r)).sort((a, b) => a.name.localeCompare(b.name)))
      setEditingId(null)
    } catch {
      await dialog.alert({ title: "Couldn't save the crop", message: 'Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(row: Row) {
    if (row._count.plantings > 0) {
      await dialog.alert({ title: "Can't delete this crop", message: `${row._count.plantings} planting(s) are recorded for it.` })
      return
    }
    if (!(await dialog.confirm({ title: `Delete ${row.name}?`, confirmLabel: 'Delete', tone: 'danger' }))) return
    const { ok, data } = await request(`/api/crop-types/${row.id}`, 'DELETE')
    if (!ok) { await dialog.alert({ title: "Couldn't delete the crop", message: data.error }); return }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  const fields = (f: Form, set: (f: Form) => void, idPrefix: string) => (
    <>
      {([
        ['daysToHarvestMin', 'Harvest from (day)'],
        ['daysToHarvestMax', 'Harvest until (day)'],
        ['vegetativeDay', 'Vegetative (day)'],
        ['floweringDay', 'Flowering (day)'],
        ['fruitingDay', 'Fruiting (day)'],
      ] as const).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`${idPrefix}-${key}`} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
          <input
            id={`${idPrefix}-${key}`}
            type="number" min="0" step="1" inputMode="numeric"
            required={key !== 'floweringDay' && key !== 'fruitingDay'}
            placeholder={key === 'floweringDay' || key === 'fruitingDay' ? 'none' : ''}
            value={f[key]}
            onChange={(e) => set({ ...f, [key]: e.target.value })}
            className={CELL_INPUT}
          />
        </div>
      ))}
    </>
  )

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Crop Types</h1>
        <span className="text-sm text-gray-500">{rows.length} crops</span>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        The crops farmers record plantings of. Growing times are counted in days from planting and are approximate;
        they set each planting&apos;s growth stages and expected harvest window. Leave flowering and fruiting empty for
        leafy crops harvested before they flower.
      </p>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add a crop</h2>
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="new-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input id="new-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={CELL_INPUT} />
          </div>
          {fields(form, setForm, 'new')}
          <div className="col-span-2 md:col-span-6 flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-1 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add crop
            </button>
            {addError && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} /> {addError}</p>}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Crop</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Harvest (days after planting)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Stages start on day</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Plantings</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400"><Sprout size={32} className="mx-auto mb-2" />No crops yet</td></tr>
              ) : rows.map((r) => editingId === r.id ? (
                <tr key={r.id} className="bg-field">
                  <td colSpan={5} className="px-4 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                      <div className="col-span-2 md:col-span-1">
                        <label htmlFor={`e-name-${r.id}`} className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                        <input id={`e-name-${r.id}`} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className={CELL_INPUT} />
                      </div>
                      {fields(editForm, setEditForm, `e${r.id}`)}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => saveEdit(r.id)} disabled={saving} className="inline-flex items-center gap-1 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg">
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1 text-xs text-gray-600 px-3 py-1.5">
                        <X size={12} /> Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">{r.daysToHarvestMin}–{r.daysToHarvestMax}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    Vegetative {r.vegetativeDay}
                    {r.floweringDay !== null && <> · Flowering {r.floweringDay}</>}
                    {r.fruitingDay !== null && <> · Fruiting {r.fruitingDay}</>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{r._count.plantings}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditingId(r.id); setEditForm(toForm(r)) }} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-paddy mr-3">
                      <Pencil size={12} /> Edit
                    </button>
                    <button onClick={() => remove(r)} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                      <Trash2 size={12} /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
