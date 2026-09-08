import Link from 'next/link'
import Image from 'next/image'
import { Tag, Leaf } from 'lucide-react'

export interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  unit: string
  imageUrl: string | null
  category: { id: number; name: string }
  farmer: { id: number; name: string; email: string }
}

export type ProductCardSize = 'small' | 'medium' | 'large'

// 'large' matches the card's original styling exactly, so every call site
// that doesn't pass `size` (homepage, sellers page, etc.) renders unchanged.
export default function ProductCard({ product, size = 'large' }: { product: Product; size?: ProductCardSize }) {
  const showDescription = size !== 'small'
  const showSeller = size !== 'small'

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <Link href={`/products/${product.id}`} className="block">

        {/* Image */}
        <div className="aspect-[4/3] relative overflow-hidden">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 text-green-300 gap-2">
              <Leaf size={size === 'small' ? 24 : 40} strokeWidth={1.5} />
              {size !== 'small' && <span className="text-xs text-green-400 font-medium">No photo yet</span>}
            </div>
          )}

          {/* Category tag */}
          {size !== 'small' && (
            <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-white/90 backdrop-blur-sm text-green-800 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 shadow-sm z-10">
              <Tag size={10} />
              {product.category.name}
            </span>
          )}

          {/* Stock badge */}
          {product.stock === 0 && (
            <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-red-500 text-white text-[9px] sm:text-xs font-semibold px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full z-10">
              Out of Stock
            </span>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-amber-500 text-white text-[9px] sm:text-xs font-semibold px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full z-10">
              Low Stock
            </span>
          )}
        </div>

        {/* Info */}
        <div className={size === 'small' ? 'p-2' : size === 'medium' ? 'p-2 pb-1.5 sm:p-3 sm:pb-2' : 'p-2.5 pb-2 sm:p-4 sm:pb-3'}>
          <h3 className={`font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 ${
            size === 'small' ? 'text-xs' : size === 'medium' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
          }`}>
            {product.name}
          </h3>
          {showDescription && (
            <p className={`text-gray-400 mt-1 leading-relaxed ${
              size === 'medium' ? 'text-xs line-clamp-1' : 'text-xs sm:text-sm line-clamp-1 sm:line-clamp-2'
            }`}>
              {product.description}
            </p>
          )}
          <div className={`flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between ${
            size === 'small' ? 'mt-1.5' : size === 'medium' ? 'mt-1.5 sm:mt-2' : 'mt-2 sm:mt-4'
          }`}>
            <div>
              <span className={`font-bold text-green-700 ${
                size === 'small' ? 'text-sm' : size === 'medium' ? 'text-sm sm:text-base' : 'text-base sm:text-xl'
              }`}>
                ₱{product.price.toFixed(2)}
              </span>
              {size !== 'small' && <span className="text-xs text-gray-400 ml-1">/ {product.unit}</span>}
            </div>
            {size === 'large' && (
              <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg">
                {parseFloat(product.stock.toFixed(2))} {product.unit} left
              </span>
            )}
          </div>
        </div>
      </Link>

      {showSeller && (
        <div className={size === 'medium' ? 'px-2 pb-2 sm:px-3 sm:pb-3' : 'px-2.5 pb-2.5 sm:px-4 sm:pb-4'}>
          <div className={size === 'medium' ? 'pt-1.5 sm:pt-2 border-t border-gray-50' : 'pt-2 sm:pt-3 border-t border-gray-50'}>
            <Link
              href={`/sellers/${product.farmer.id}`}
              className="text-[10px] sm:text-xs text-green-600 hover:text-green-800 font-medium hover:underline transition-colors"
            >
              by {product.farmer.name}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
