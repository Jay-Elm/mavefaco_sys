import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, Sprout } from 'lucide-react'
import { CrateLabel } from '@/components/ProductCard'
import AddToCartButton from '@/components/AddToCartButton'
import ReviewsSection from '@/components/ReviewsSection'
import { redirectRoles } from '@/lib/serverSession'
import { withComingSoon } from '@/lib/comingSoon'
import { fmtWindow } from '@/components/cropDisplay'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // The storefront is for shoppers; staff work from the dashboard.
  await redirectRoles(['admin', 'manager'])
  const { id } = await params
  const productId = Number(id)

  if (isNaN(productId)) notFound()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      farmer: { select: { id: true, name: true, email: true } },
    },
  })

  if (!product || !product.approved || product.archivedAt) notFound()
  const [{ comingSoon }] = await withComingSoon([product])

  const price = Number(product.price)

  const postedDate = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(product.createdAt))

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-paddy mb-6 transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All products
      </Link>

      <div className="grid gap-8 lg:gap-12 md:grid-cols-2">
        {/* Photo, or the crate label when there isn't one yet */}
        <div className="aspect-[4/3] md:aspect-square relative rounded-card overflow-hidden bg-field">
          <CrateLabel name={product.name} size="large" />
          {product.imageUrl && (
            <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-cover" />
          )}
        </div>

        <div className="flex flex-col">
          <Link href={`/products?categoryId=${product.category.id}`} className="text-sm text-gray-600 hover:text-paddy self-start">
            {product.category.name}
          </Link>
          <h1 className="mt-1 font-display text-5xl sm:text-6xl font-extrabold leading-[0.95]">{product.name}</h1>

          <p className="mt-4 flex items-baseline gap-2">
            <span className="font-display text-4xl font-bold tabular">₱{price.toFixed(2)}</span>
            <span className="text-gray-600">per {product.unit}</span>
          </p>

          {product.description && (
            <p className="mt-5 text-[1.05rem] leading-relaxed text-gray-700 max-w-[60ch] whitespace-pre-wrap">{product.description}</p>
          )}

          {comingSoon && (
            <div className="mt-6 rounded-lg bg-calamansi/25 border border-calamansi px-4 py-3 text-sm flex items-start gap-2">
              <Sprout size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                <span className="font-semibold">Coming soon.</span> Expected harvest {fmtWindow(comingSoon.harvestStart, comingSoon.harvestEnd)}.
              </p>
            </div>
          )}

          <dl className="mt-6 divide-y divide-gray-200 border-y border-gray-200 text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-gray-600">Available</dt>
              <dd className={`font-semibold tabular ${product.stock > 0 ? 'text-soil' : 'text-red-700'}`}>
                {product.stock > 0 ? `${parseFloat(product.stock.toFixed(2))} ${product.unit}` : 'Out of stock'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-gray-600">Farmer</dt>
              <dd>
                <Link href={`/sellers/${product.farmer.id}`} className="font-semibold text-paddy hover:underline">
                  {product.farmer.name}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-gray-600">Listed on</dt>
              <dd>{postedDate}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <AddToCartButton
              product={{
                id: product.id,
                name: product.name,
                price,
                imageUrl: product.imageUrl,
                stock: product.stock,
                unit: product.unit,
                farmerId: product.farmer.id,
                farmerName: product.farmer.name,
              }}
            />
          </div>
        </div>
      </div>

      <ReviewsSection productId={productId} />
    </div>
  )
}
