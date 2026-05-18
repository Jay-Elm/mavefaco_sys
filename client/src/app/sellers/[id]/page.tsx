import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import ProductCard from '@/components/ProductCard'
import { ShieldCheck, ShieldAlert, User, CalendarDays, Package, ArrowLeft, Star, MessageCircle } from 'lucide-react'

export default async function SellerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const farmerId = Number(id)
  if (isNaN(farmerId)) notFound()

  const farmer = await prisma.user.findUnique({
    where: { id: farmerId, role: 'farmer' },
    select: {
      id: true,
      name: true,
      verified: true,
      createdAt: true,
      products: {
        where: { approved: true },
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
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Products
      </Link>

      {/* Seller header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <User size={28} className="text-green-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{farmer.name}</h1>
              {farmer.verified ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck size={11} /> Verified Farmer
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  <ShieldAlert size={11} /> Unverified
                </span>
              )}
            </div>
            <div className="flex items-center gap-5 mt-2 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1.5">
                <Package size={14} />
                {farmer.products.length} product{farmer.products.length !== 1 ? 's' : ''} listed
              </span>
              {avgRating !== null && (
                <span className="flex items-center gap-1.5">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {avgRating.toFixed(1)} avg rating ({allRatings.length} review{allRatings.length !== 1 ? 's' : ''})
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} />
                Member since {memberSince}
              </span>
            </div>
          </div>
          <Link
            href={`/customer/messages/${farmer.id}`}
            className="ml-auto shrink-0 inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <MessageCircle size={15} /> Message Farmer
          </Link>
        </div>
      </div>

      {/* Products */}
      <h2 className="text-lg font-bold text-gray-900 mb-5">
        Products by {farmer.name}
      </h2>

      {farmer.products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={40} className="mx-auto mb-3" />
          <p>This farmer has no listed products yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {farmer.products.map(({ reviews: _r, ...product }) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
