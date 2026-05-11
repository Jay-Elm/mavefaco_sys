import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/ProductCard'
import { Package, SlidersHorizontal } from 'lucide-react'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>
}) {
  const { categoryId } = await searchParams
  const activeCategoryId = categoryId ? Number(categoryId) : null

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: activeCategoryId ? { categoryId: activeCategoryId } : {},
      include: {
        category: true,
        farmer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-500 mt-1">Browse fresh products from local farmers</p>
      </div>

      {/* Category filter */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          <SlidersHorizontal size={16} className="text-gray-500 shrink-0" />
          <Link
            href="/products"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !activeCategoryId
                ? 'bg-green-700 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:border-green-500 hover:text-green-700'
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?categoryId=${cat.id}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-green-700 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-green-500 hover:text-green-700'
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      )}

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} className="mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500">No products found</p>
          <p className="text-sm mt-1">
            {activeCategoryId ? 'Try a different category.' : 'Check back soon!'}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {products.length} product{products.length !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
