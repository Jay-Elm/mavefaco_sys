'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Tag, Trash2, Plus, AlertCircle, Search, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

interface Category {
  id: number
  name: string
  createdAt: string
  _count: { products: number }
}

type SortKey = 'name' | 'products' | 'createdAt'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-gray-300 inline ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-gray-600 inline ml-1" />
    : <ChevronDown size={13} className="text-gray-600 inline ml-1" />
}

export default function CategoriesPage() {
  const { token } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [newName, setNewName]       = useState('')
  const [adding, setAdding]         = useState(false)
  const [addError, setAddError]     = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function load() {
    if (!token) return
    fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setCategories(data)
      })
      .catch(() => setError('Failed to load categories'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = useMemo(() => {
    let list = [...categories]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((c) => c.name.toLowerCase().includes(q))
    }

    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')      diff = a.name.localeCompare(b.name)
      if (sortKey === 'products')  diff = a._count.products - b._count.products
      if (sortKey === 'createdAt') diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return sortDir === 'asc' ? diff : -diff
    })

    return list
  }, [categories, search, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !token) return
    setAdding(true)
    setAddError('')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error); return }
      setCategories((prev) => [...prev, { ...data, _count: { products: 0 } }])
      setNewName('')
      inputRef.current?.focus()
    } catch {
      setAddError('Failed to create category')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: number, productCount: number) {
    if (productCount > 0) {
      alert(`Cannot delete: ${productCount} product(s) use this category.`)
      return
    }
    if (!confirm('Delete this category?')) return
    if (!token) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setCategories((prev) => prev.filter((c) => c.id !== id))
    } catch {
      alert('Failed to delete category')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <span className="text-sm text-gray-500">{categories.length} total</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Add category */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add New Category</h2>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="flex items-center gap-1 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </form>
        {addError && (
          <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
            <AlertCircle size={12} /> {addError}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {displayed.length} of {categories.length} categories
        </span>
        <button
          onClick={() => downloadCSV(
            'categories.csv',
            ['Name', 'Products', 'Created Date'],
            displayed.map((c) => [
              c.name, c._count.products,
              new Date(c.createdAt).toLocaleDateString('en-PH'),
            ])
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {/* Category list */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-5 py-3 text-left font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('name')}
              >
                Name <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-5 py-3 text-center font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('products')}
              >
                Products <SortIcon col="products" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-5 py-3 text-left font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('createdAt')}
              >
                Created <SortIcon col="createdAt" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  <Tag size={32} className="mx-auto mb-2" />
                  {categories.length === 0 ? 'No categories yet' : 'No categories match your search'}
                </td>
              </tr>
            ) : (
              displayed.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{cat.name}</td>
                  <td className="px-5 py-3 text-center text-gray-600">{cat._count.products}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(cat.createdAt).toLocaleDateString('en-PH')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(cat.id, cat._count.products)}
                      disabled={deletingId === cat.id}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
                    >
                      {deletingId === cat.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
