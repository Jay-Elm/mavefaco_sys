'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/contexts/DialogContext'
import { AlertCircle, Check, Loader2, Pencil, Plus, Search, Sprout, Trash2, X } from 'lucide-react'
import type { CropType } from '@/components/cropDisplay'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import { CROP_CATEGORIES, byCategory } from '@/lib/cropCategories'
import { searchCrops } from '@/lib/cropKeywords'

type Row = CropType & { _count: { plantings: number; products: number } }
type Form = { name: string; category: string; daysToHarvestMin: string; daysToHarvestMax: string; aliases: string; source: string }

const EMPTY: Form = { name: '', category: 'Fruit vegetables', daysToHarvestMin: '', daysToHarvestMax: '', aliases: '', source: '' }
const CELL_INPUT = 'w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-paddy'

const toForm = (c: CropType): Form => ({
  name: c.name,
  category: c.category ?? 'Other vegetables',
  daysToHarvestMin: c.daysToHarvestMin === null ? '' : String(c.daysToHarvestMin),
  daysToHarvestMax: c.daysToHarvestMax === null ? '' : String(c.daysToHarvestMax),
  aliases: (c.aliases ?? []).join(', '),
  source: c.source ?? '',
})
const toBody = (f: Form) => ({
  name: f.name.trim(),
  category: f.category,
  daysToHarvestMin: f.daysToHarvestMin.trim() === '' ? null : Number(f.daysToHarvestMin),
  daysToHarvestMax: f.daysToHarvestMax.trim() === '' ? null : Number(f.daysToHarvestMax),
  aliases: f.aliases,
  source: f.source.trim(),
})

export default function CropTypesPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
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
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    if (!token) return
    fetch('/api/crop-types', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setRows(d)))
      .catch(() => setError('Failed to load crop types'))
      .finally(() => setLoading(false))
  }, [token, live])

  const shown = useMemo(() => {
    const inCategory = rows.filter((r) => category === 'all' || r.category === category)
    return query.trim() ? searchCrops(query, inCategory).map((x) => x.crop) : byCategory(inCategory)
  }, [rows, query, category])

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
      setRows((prev) => [...prev, { _count: { plantings: 0, products: 0 }, ...data }])
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
      setRows((prev) => prev.map((r) => (r.id === id ? data : r)))
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
    if (!(await dialog.confirm({
      title: `Delete ${row.name}?`,
      message: row._count.products > 0 ? `${row._count.products} listing(s) are linked to it; they'll become unlinked.` : undefined,
      confirmLabel: 'Delete', tone: 'danger',
    }))) return
    const { ok, data } = await request(`/api/crop-types/${row.id}`, 'DELETE')
    if (!ok) { await dialog.alert({ title: "Couldn't delete the crop", message: data.error }); return }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  const fields = (f: Form, set: (f: Form) => void, idPrefix: string) => (
    <>
      <div>
        <label htmlFor={`${idPrefix}-category`} className="block text-xs font-medium text-gray-600 mb-1">Category</label>
        <select id={`${idPrefix}-category`} value={f.category} onChange={(e) => set({ ...f, category: e.target.value })} className={CELL_INPUT}>
          {CROP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      {([
        ['daysToHarvestMin', 'Harvest from (day)'],
        ['daysToHarvestMax', 'Harvest until (day)'],
      ] as const).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`${idPrefix}-${key}`} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
          <input
            id={`${idPrefix}-${key}`}
            type="number" min="0" step="1" inputMode="numeric"
            placeholder="Not set"
            value={f[key]}
            onChange={(e) => set({ ...f, [key]: e.target.value })}
            className={CELL_INPUT}
          />
        </div>
      ))}
      <div className="col-span-2 md:col-span-4">
        <label htmlFor={`${idPrefix}-aliases`} className="block text-xs font-medium text-gray-600 mb-1">
          Other names <span className="font-normal text-gray-500">(English, Filipino or Bikol, separated by commas; listings named with any of them link to this crop)</span>
        </label>
        <input id={`${idPrefix}-aliases`} value={f.aliases} onChange={(e) => set({ ...f, aliases: e.target.value })} placeholder="e.g. talong, eggplant" className={CELL_INPUT} />
      </div>
      <div className="col-span-2 md:col-span-4">
        <label htmlFor={`${idPrefix}-source`} className="block text-xs font-medium text-gray-600 mb-1">
          Source of the growing time <span className="font-normal text-gray-500">(optional, e.g. the DA production guide)</span>
        </label>
        <input id={`${idPrefix}-source`} maxLength={300} value={f.source} onChange={(e) => set({ ...f, source: e.target.value })} className={CELL_INPUT} />
      </div>
    </>
  )

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-soil">Crop Types</h1>
        <span className="text-sm text-gray-500">{rows.length} crops</span>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl">
        Every vegetable, root crop and fruit PSA records as grown in the Bicol region, plus palay, corn and plantation food crops. Farmers
        record plantings of these and link their listings to them, so sales count on the Market page whatever a listing is called. Growing
        times come from Department of Agriculture guides where one exists; a crop without one asks the farmer for harvest dates.
      </p>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add a crop</h2>
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="new-name" className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input id="new-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={CELL_INPUT} />
          </div>
          {fields(form, setForm, 'new')}
          <div className="col-span-2 md:col-span-4 flex items-center gap-3">
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

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search any name, e.g. talong" aria-label="Search crops"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-paddy" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">All categories</option>
          {CROP_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span className="text-sm text-gray-500">{shown.length} shown</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Crop</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Harvest (days after planting)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">PSA data</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Listings</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Plantings</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-500"><Sprout size={32} className="mx-auto mb-2" />No crops match</td></tr>
              ) : shown.map((r, i) => {
                const heading = !query.trim() && r.category !== shown[i - 1]?.category
                return (
                  <React.Fragment key={r.id}>
                    {heading && (
                      <tr className="bg-field"><td colSpan={6} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{r.category}</td></tr>
                    )}
                    {editingId === r.id ? (
                      <tr className="bg-field">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
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
                      <tr className="hover:bg-gray-50 align-top">
                        <td className="px-4 py-3">
                          <p className="font-medium text-soil">{r.name}</p>
                          {(r.aliases?.length ?? 0) > 0 && <p className="mt-0.5 text-xs text-gray-500 max-w-md">Also: {r.aliases!.join(', ')}</p>}
                          {r.source && <p className="mt-0.5 text-xs text-gray-500 max-w-md">{r.source}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 tabular-nums">
                          {r.daysToHarvestMin !== null ? `${r.daysToHarvestMin}–${r.daysToHarvestMax}` : <span className="text-gray-500">Not set</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {r.psaProduction ? 'Production' : '—'}
                          {r.psaPrice && <span className="block">Farmgate price</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">{r._count.products}</td>
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
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
