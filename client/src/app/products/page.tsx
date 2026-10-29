import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import ProductGrid from '@/components/ProductGrid'
import ProductFilters from '@/components/ProductFilters'
import { Suspense } from 'react'
import { redirectRoles } from '@/lib/serverSession'
import { withComingSoon } from '@/lib/comingSoon'

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; search?: string; minPrice?: string; maxPrice?: string }>
}) {
  // The storefront is for shoppers; staff work from the dashboard.
  await redirectRoles(['admin', 'manager'])
  const { categoryId, search, minPrice, maxPrice } = await searchParams

  const activeCategoryId = categoryId ? Number(categoryId) : null
  const minPriceNum = minPrice ? Number(minPrice) : null
  const maxPriceNum = maxPrice ? Number(maxPrice) : null

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        approved: true,
        archivedAt: null,
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
  const activeCategory = categories.find((c) => c.id === activeCategoryId) ?? null

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="mb-6">
        {/* Arriving from a home page shelf, the page is named after its category. */}
        {activeCategory && (
          <Link href="/products" className="inline-flex items-center gap-1 text-sm font-medium text-paddy hover:underline mb-2">
            <ChevronLeft size={15} aria-hidden="true" /> All products
          </Link>
        )}
        <h1 className="font-display text-5xl sm:text-6xl font-extrabold leading-[0.95]">{activeCategory?.name ?? 'Products'}</h1>
        <p className="text-gray-600 mt-2">
          {activeCategory
            ? `What member farmers have listed in ${activeCategory.name}, newest first.`
            : 'Everything member farmers have listed, newest first.'}
        </p>
      </div>

      <Suspense>
        <ProductFilters categories={categories} />
      </Suspense>

      {products.length === 0 ? (
        <div className="rounded-card border border-dashed border-gray-300 px-6 py-14 max-w-xl">
          <p className="font-display text-3xl font-bold">No products match</p>
          <p className="mt-2 text-gray-600">Try another search, a different category or a wider price range.</p>
        </div>
      ) : (
        <ProductGrid products={await withComingSoon(products.map((p) => ({ ...p, price: Number(p.price) })))} />
      )}
    </div>
  )
}
