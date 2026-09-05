import Link from 'next/link'
import Image from 'next/image'
import { Tag, Leaf } from 'lucide-react'

interface Product {
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

export default function ProductCard({ product }: { product: Product }) {
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
              <Leaf size={40} strokeWidth={1.5} />
              <span className="text-xs text-green-400 font-medium">No photo yet</span>
            </div>
          )}

          {/* Category tag */}
          <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-white/90 backdrop-blur-sm text-green-800 text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full flex items-center gap-1 shadow-sm z-10">
            <Tag size={10} />
            {product.category.name}
          </span>

          {/* Stock badge */}
          {product.stock === 0 && (
            <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-red-500 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full z-10">
              Out of Stock
            </span>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-amber-500 text-white text-[10px] sm:text-xs font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full z-10">
              Low Stock
            </span>
          )}
        </div>

        {/* Info */}
        <div className="p-2.5 pb-2 sm:p-4 sm:pb-3">
          <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1 text-sm sm:text-base">
            {product.name}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1 line-clamp-1 sm:line-clamp-2 leading-relaxed">
            {product.description}
          </p>
          <div className="mt-2 sm:mt-4 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-base sm:text-xl font-bold text-green-700">₱{product.price.toFixed(2)}</span>
              <span className="text-xs text-gray-400 ml-1">/ {product.unit}</span>
            </div>
            <span className="text-[10px] sm:text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg">
              {parseFloat(product.stock.toFixed(2))} {product.unit} left
            </span>
          </div>
        </div>
      </Link>

      <div className="px-2.5 pb-2.5 sm:px-4 sm:pb-4">
        <div className="pt-2 sm:pt-3 border-t border-gray-50">
          <Link
            href={`/sellers/${product.farmer.id}`}
            className="text-[10px] sm:text-xs text-green-600 hover:text-green-800 font-medium hover:underline transition-colors"
          >
            by {product.farmer.name}
          </Link>
        </div>
      </div>
    </div>
  )
}
