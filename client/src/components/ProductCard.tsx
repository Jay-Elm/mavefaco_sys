import Link from 'next/link'
import Image from 'next/image'
import { Sprout } from 'lucide-react'
import { fmtWindow } from '@/components/cropDisplay'

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
  // Out of stock, with a harvest on the way (src/lib/comingSoon.ts).
  comingSoon?: { harvestStart: string; harvestEnd: string } | null
}

export type ProductCardSize = 'small' | 'medium' | 'large'

const NAME_TEXT: Record<ProductCardSize, string> = {
  small: 'text-xs sm:text-sm',
  medium: 'text-sm sm:text-[0.95rem]',
  large: 'text-sm sm:text-base',
}

const PRICE_TEXT: Record<ProductCardSize, string> = {
  small: 'text-lg',
  medium: 'text-xl sm:text-2xl',
  large: 'text-xl sm:text-3xl',
}

const BODY_PAD: Record<ProductCardSize, string> = {
  small: 'p-2',
  medium: 'p-2.5 sm:p-3',
  large: 'p-3 sm:p-4',
}

// Stock state, worded the same everywhere a product shows.
function stockBadge(product: Product) {
  if (product.stock === 0 && product.comingSoon)
    return { label: 'Coming soon', className: 'bg-calamansi text-soil', icon: true }
  if (product.stock === 0) return { label: 'Out of stock', className: 'bg-white text-red-700 border border-red-200', icon: false }
  if (product.stock <= 5) return { label: 'Low stock', className: 'bg-amber-100 text-amber-900', icon: false }
  return null
}

/**
 * A product with no photo yet shows as a stencilled crate label: the
 * product's name, the way produce crates at the market are marked.
 */
export function CrateLabel({ name, size }: { name: string; size: ProductCardSize }) {
  return (
    <div className="absolute inset-0 bg-[#E6DAC2] flex items-center justify-center p-3" aria-hidden="true">
      <div className="w-full h-full border-2 border-dashed border-soil/25 rounded-md flex items-center justify-center text-center px-2">
        <span
          className={`font-stencil uppercase text-soil/70 leading-[0.95] break-words ${
            size === 'small' ? 'text-lg' : 'text-2xl sm:text-4xl'
          }`}
        >
          {name}
        </span>
      </div>
    </div>
  )
}

// 'large' is the default so call sites that don't pass `size` (homepage,
// sellers page, etc.) render at full size.
export default function ProductCard({
  product,
  size = 'large',
  showCategory = true,
}: {
  product: Product
  size?: ProductCardSize
  /** Off where the category is already named, as on a home page shelf. */
  showCategory?: boolean
}) {
  const badge = stockBadge(product)
  const showDetails = size !== 'small'

  return (
    <article className="group bg-white rounded-card border border-gray-200 overflow-hidden flex flex-col hover:border-gray-300 transition-colors">
      <Link href={`/products/${product.id}`} className="flex flex-col flex-1">
        <div className="aspect-[4/3] relative overflow-hidden bg-field">
          {/* The crate label sits under the photo too, so a photo that is
              slow to load or missing still shows what the product is. */}
          <CrateLabel name={product.name} size={size} />
          {product.imageUrl && (
            <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-cover" />
          )}
          {badge && (
            <span
              className={`absolute top-2 right-2 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 ${badge.className}`}
            >
              {badge.icon && <Sprout size={12} aria-hidden="true" className="hidden sm:block" />}
              {badge.label}
            </span>
          )}
        </div>

        <div className={`flex-1 ${BODY_PAD[size]}`}>
          {showDetails && showCategory && <p className="text-[11px] sm:text-xs text-gray-500 truncate">{product.category.name}</p>}
          <h3 className={`font-semibold text-soil line-clamp-1 group-hover:underline underline-offset-2 ${NAME_TEXT[size]}`}>
            {product.name}
          </h3>
          <p className="mt-1 flex items-baseline gap-1">
            <span className={`font-display font-bold text-soil leading-none tabular ${PRICE_TEXT[size]}`}>
              ₱{product.price.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">/ {product.unit}</span>
          </p>
        </div>
      </Link>

      {showDetails && (
        <div className={`border-t border-gray-100 flex items-center justify-between gap-2 text-[11px] sm:text-xs ${size === 'large' ? 'px-3 py-2 sm:px-4' : 'px-2.5 py-1.5 sm:px-3'}`}>
          <Link href={`/sellers/${product.farmer.id}`} className="text-paddy font-medium hover:underline truncate">
            {product.farmer.name}
          </Link>
          {size === 'large' && (
            <span className="shrink-0 text-gray-500 tabular">
              {product.stock === 0 && product.comingSoon
                ? `Expected ${fmtWindow(product.comingSoon.harvestStart, product.comingSoon.harvestEnd).replace(/, \d{4}$/, '')}`
                : product.stock === 0
                  ? 'None left'
                  : `${parseFloat(product.stock.toFixed(2))} ${product.unit} left`}
            </span>
          )}
        </div>
      )}
    </article>
  )
}
