import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/ProductCard'
import ProductFilters from '@/components/ProductFilters'
import { Package } from 'lucide-react'
import { Suspense } from 'react'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; search?: string; minPrice?: string; maxPrice?: string }>
}) {
  const { categoryId, search, minPrice, maxPrice } = await searchParams

  const activeCategoryId = categoryId ? Number(categoryId) : null
  const minPriceNum = minPrice ? Number(minPrice) : null
  const maxPriceNum = maxPrice ? Number(maxPrice) : null

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        approved: true,
        ...(activeCategoryId ? { categoryId: activeCategoryId } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(minPriceNum !== null || maxPriceNum !== null
          ? {
              price: {
                ...(minPriceNum !== null ? { gte: minPriceNum } : {}),
                ...(maxPriceNum !== null ? { lte: maxPriceNum } : {}),
              },
            }
          : {}),
      },
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

      <Suspense>
        <ProductFilters categories={categories} />
      </Suspense>

      {products.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} className="mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500">No products found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {products.length} product{products.length !== 1 ? 's' : ''} found
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
