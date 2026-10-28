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
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy bg-white"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); router.push(buildUrl({ search: null })) }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-soil"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="btn btn-primary py-2.5 text-sm"
        >
          Search
        </button>
      </form>

      {/* Category + price row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-6 px-6 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <SlidersHorizontal size={15} aria-hidden="true" className="text-gray-500 shrink-0" />
          <button
            onClick={() => setCategory(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategoryId
                ? 'bg-paddy text-white border border-paddy'
                : 'bg-white text-soil border border-gray-300 hover:border-paddy hover:text-paddy'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(String(cat.id))}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategoryId === String(cat.id)
                  ? 'bg-paddy text-white border border-paddy'
                  : 'bg-white text-soil border border-gray-300 hover:border-paddy hover:text-paddy'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Price filter */}
        <form onSubmit={handlePriceSubmit} className="flex items-center gap-1.5 ml-auto">
          <span className="text-sm text-gray-600 shrink-0">Price ₱</span>
          <input
            type="number"
            min={0}
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            placeholder="Min"
            aria-label="Minimum price"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
          />
          <span className="text-gray-500 text-sm" aria-hidden="true">to</span>
          <input
            type="number"
            min={0}
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            placeholder="Max"
            aria-label="Maximum price"
            className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
          />
          <button
            type="submit"
            className="px-3 py-1.5 border border-gray-300 text-soil text-sm font-medium rounded-lg hover:border-paddy hover:text-paddy transition-colors"
          >
            Apply
          </button>
        </form>
      </div>

      {/* Active filter summary + clear */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <span>Showing:</span>
          {activeSearch && <span className="bg-shoot text-paddy-deep px-2 py-0.5 rounded-full text-xs font-medium">&ldquo;{activeSearch}&rdquo;</span>}
          {activeCategoryId && <span className="bg-shoot text-paddy-deep px-2 py-0.5 rounded-full text-xs font-medium">{categories.find(c => String(c.id) === activeCategoryId)?.name ?? 'Category'}</span>}
          {(activeMin || activeMax) && (
            <span className="bg-shoot text-paddy-deep px-2 py-0.5 rounded-full text-xs font-medium">
              ₱{activeMin || '0'} – {activeMax ? `₱${activeMax}` : 'any'}
            </span>
          )}
          <button onClick={clearAll} className="ml-1 text-paddy hover:text-paddy-deep text-xs font-semibold underline">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
