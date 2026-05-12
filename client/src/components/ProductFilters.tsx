'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'

interface Category {
  id: number
  name: string
}

interface Props {
  categories: Category[]
}

export default function ProductFilters({ categories }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '')

  const activeCategoryId = searchParams.get('categoryId')
  const activeSearch = searchParams.get('search')
  const activeMin = searchParams.get('minPrice')
  const activeMax = searchParams.get('maxPrice')
  const hasActiveFilters = activeCategoryId || activeSearch || activeMin || activeMax

  const buildUrl = useCallback(
    (overrides: Record<string, string | null>) => {
      const merged: Record<string, string | null> = {
        categoryId: searchParams.get('categoryId'),
        search: searchParams.get('search'),
        minPrice: searchParams.get('minPrice'),
        maxPrice: searchParams.get('maxPrice'),
        ...overrides,
      }
      const params = new URLSearchParams()
      Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
      const qs = params.toString()
      return qs ? `/products?${qs}` : '/products'
    },
    [searchParams],
  )

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ search: search.trim() || null }))
  }

  function handlePriceSubmit(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ minPrice: minPrice || null, maxPrice: maxPrice || null }))
  }

  function setCategory(id: string | null) {
    router.push(buildUrl({ categoryId: id }))
  }

  function clearAll() {
    setSearch('')
    setMinPrice('')
    setMaxPrice('')
    router.push('/products')
  }

  return (
    <div className="space-y-4 mb-8">
      {/* Search bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); router.push(buildUrl({ search: null })) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-green-700 text-white text-sm font-medium rounded-xl hover:bg-green-800 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Category + price row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SlidersHorizontal size={15} className="text-gray-400 shrink-0" />
          <button
            onClick={() => setCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategoryId
                ? 'bg-green-700 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:border-green-500 hover:text-green-700'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(String(cat.id))}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategoryId === String(cat.id)
                  ? 'bg-green-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-green-500 hover:text-green-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Price filter */}
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1.5 ml-auto">
          <span className="text-sm text-gray-500 shrink-0">₱</span>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            placeholder="Min"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="Max"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Go
          </button>
        </form>
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>Filtering by:</span>
          {activeSearch && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">"{activeSearch}"</span>}
          {activeCategoryId && <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">{categories.find(c => String(c.id) === activeCategoryId)?.name ?? 'Category'}</span>}
          {(activeMin || activeMax) && (
            <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
              ₱{activeMin || '0'} – {activeMax ? `₱${activeMax}` : 'any'}
            </span>
          )}
          <button onClick={clearAll} className="ml-1 text-red-500 hover:text-red-700 text-xs underline">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
