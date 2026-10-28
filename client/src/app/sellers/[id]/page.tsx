import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/ProductCard'
import { ShieldCheck, ShieldAlert, CalendarDays, Package, ArrowLeft, Star } from 'lucide-react'
import { redirectRoles } from '@/lib/serverSession'
import MessageFarmerLink from '@/components/MessageFarmerLink'
import { withComingSoon } from '@/lib/comingSoon'

export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // The storefront is for shoppers; staff work from the dashboard.
  await redirectRoles(['admin', 'manager'])
  const { id } = await params
  const farmerId = Number(id)
  if (isNaN(farmerId)) notFound()

  const farmer = await prisma.user.findUnique({
    where: { id: farmerId, role: 'farmer', deletedAt: null },
    select: {
      id: true,
      name: true,
      verified: true,
      createdAt: true,
      products: {
        where: { approved: true, archivedAt: null },
        include: {
          category: true,
          farmer: { select: { id: true, name: true, email: true } },
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!farmer) notFound()

  const allRatings = farmer.products.flatMap((p) => p.reviews.map((r) => r.rating))
  const avgRating = allRatings.length
    ? allRatings.reduce((s, r) => s + r, 0) / allRatings.length
    : null

  const memberSince = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(farmer.createdAt))

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-paddy mb-6 transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All products
      </Link>

      {/* Seller header */}
      <div className="pb-8 mb-8 border-b border-gray-200 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div className="min-w-0">
          {farmer.verified ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-paddy-deep bg-shoot px-2.5 py-1 rounded-full">
              <ShieldCheck size={12} aria-hidden="true" /> Verified farmer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full">
              <ShieldAlert size={12} aria-hidden="true" /> Unverified
            </span>
          )}
          <h1 className="mt-3 font-display text-5xl sm:text-6xl font-extrabold leading-[0.95]">{farmer.name}</h1>
          <div className="flex items-center gap-x-5 gap-y-1 mt-3 text-sm text-gray-600 flex-wrap">
            <span className="flex items-center gap-1.5 tabular">
              <Package size={14} aria-hidden="true" />
              {farmer.products.length} product{farmer.products.length !== 1 ? 's' : ''} listed
            </span>
            {avgRating !== null && (
              <span className="flex items-center gap-1.5 tabular">
                <Star size={14} aria-hidden="true" className="fill-calamansi text-calamansi" />
                {avgRating.toFixed(1)} average from {allRatings.length} review{allRatings.length !== 1 ? 's' : ''}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} aria-hidden="true" />
              Member since {memberSince}
            </span>
          </div>
        </div>
        <MessageFarmerLink farmerId={farmer.id} />
      </div>

      <h2 className="font-display text-4xl font-bold mb-6">Their products</h2>

      {farmer.products.length === 0 ? (
        <p className="text-gray-600">This farmer has no products listed right now.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
          {(await withComingSoon(farmer.products)).map((product) => (
            <ProductCard key={product.id} product={{ ...product, price: Number(product.price) }} />
          ))}
        </div>
      )}
    </div>
  )
}
