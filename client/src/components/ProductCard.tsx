import Link from 'next/link'
import Image from 'next/image'
import { Tag, Package } from 'lucide-react'

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
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
      <Link href={`/products/${product.id}`} className="block">
        <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              unoptimized
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <Package size={48} />
            </div>
          )}
          <span className="absolute top-2 left-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 z-10">
            <Tag size={10} />
            {product.category.name}
          </span>
        </div>

        <div className="p-4 pb-2">
          <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <span className="text-lg font-bold text-green-700">₱{product.price.toFixed(2)}</span>
              <span className="text-xs text-gray-400 ml-1">/ {product.unit}</span>
            </div>
            <span className="text-xs text-gray-400">
              {parseFloat(product.stock.toFixed(2))} {product.unit}
            </span>
          </div>
        </div>
      </Link>

      <div className="px-4 pb-4">
        <Link
          href={`/sellers/${product.farmer.id}`}
          className="text-xs text-green-700 hover:underline"
        >
          by {product.farmer.name}
        </Link>
      </div>
    </div>
  )
}
