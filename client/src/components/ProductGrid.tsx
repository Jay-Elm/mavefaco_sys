'use client'

import { useState, useEffect } from 'react'
import ProductCard, { type Product, type ProductCardSize } from '@/components/ProductCard'

const GRID_CLASSES: Record<ProductCardSize, string> = {
  large: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6',
  medium: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4',
  small: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3',
}

const SIZES: ProductCardSize[] = ['small', 'medium', 'large']
const STORAGE_KEY = 'products_card_size'

export default function ProductGrid({ products }: { products: Product[] }) {
  const [size, setSize] = useState<ProductCardSize>('medium')

  // Restore the visitor's last choice, if any — falls back to the medium
  // default silently if storage is unavailable or empty.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'small' || stored === 'medium' || stored === 'large') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSize(stored)
      }
    } catch {}
  }, [])

  function changeSize(next: ProductCardSize) {
    setSize(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-sm text-gray-500">
          {products.length} product{products.length !== 1 ? 's' : ''} found
        </p>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1" role="group" aria-label="Card size">
          {SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSize(s)}
              aria-pressed={size === s}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                size === s ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className={`grid ${GRID_CLASSES[size]}`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} size={size} />
        ))}
      </div>
    </>
  )
}
