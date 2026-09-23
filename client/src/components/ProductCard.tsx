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

const NAME_TEXT: Record<ProductCardSize, string> = {
  small: 'text-xs',
  medium: 'text-xs sm:text-sm',
  large: 'text-sm sm:text-base',
}

const PRICE_TEXT: Record<ProductCardSize, string> = {
  small: 'text-sm',
  medium: 'text-sm sm:text-base',
  large: 'text-base sm:text-xl',
}

const OVERLAY_PAD: Record<ProductCardSize, string> = {
  small: 'p-2',
  medium: 'p-2 sm:p-3',
  large: 'p-2.5 sm:p-4',
}

const FOOTER_PAD: Record<ProductCardSize, string> = {
  small: '',
  medium: 'px-2 py-1.5 sm:px-3 sm:py-2',
  large: 'px-2.5 py-2 sm:px-4 sm:py-2.5',
}

// 'large' is the default so call sites that don't pass `size` (homepage,
// sellers page, etc.) render at full size.
export default function ProductCard({ product, size = 'large' }: { product: Product; size?: ProductCardSize }) {
  const showSeller = size !== 'small'
  const hasImage = !!product.imageUrl

  return (
    <div className="group bg-tint rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <Link href={`/products/${product.id}`} className="block">

        {/* Photo — fills the card; name + price sit directly on it, market-stall-label style. */}
        <div className="aspect-[4/5] relative overflow-hidden bg-gradient-to-br from-green-50 to-emerald-100">
          {hasImage && (
            <Image
              src={product.imageUrl as string}
              alt={product.name}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}

          {!hasImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-green-300 gap-2">
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

          {/* Name + price — overlaid on a scrim when there's a real photo behind
              them; dark text with no scrim over the plain placeholder tint,
              since white text there wouldn't have enough contrast. */}
          {hasImage && (
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent pointer-events-none" />
          )}
          <div className={`absolute inset-x-0 bottom-0 ${OVERLAY_PAD[size]}`}>
            <h3 className={`font-semibold line-clamp-1 ${NAME_TEXT[size]} ${hasImage ? 'text-white' : 'text-gray-900'}`}>
              {product.name}
            </h3>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`font-bold ${PRICE_TEXT[size]} ${hasImage ? 'text-white' : 'text-forest'}`}>
                ₱{product.price.toFixed(2)}
              </span>
              {size !== 'small' && (
                <span className={hasImage ? 'text-white/70 text-xs' : 'text-gray-500 text-xs'}>
                  / {product.unit}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {showSeller && (
        <div className={`bg-tint flex items-center justify-between gap-2 border-t border-white/60 ${FOOTER_PAD[size]}`}>
          <Link
            href={`/sellers/${product.farmer.id}`}
            className="text-[10px] sm:text-xs text-forest-mid hover:text-forest font-medium hover:underline transition-colors truncate"
          >
            by {product.farmer.name}
          </Link>
          {size === 'large' && (
            <span className="shrink-0 text-[10px] sm:text-xs text-gray-500">
              {parseFloat(product.stock.toFixed(2))} {product.unit} left
            </span>
          )}
        </div>
      )}
    </div>
  )
}
