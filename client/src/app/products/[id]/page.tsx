import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { Package, ArrowLeft, Tag, User, CalendarDays } from 'lucide-react'
import AddToCartButton from '@/components/AddToCartButton'
import ReviewsSection from '@/components/ReviewsSection'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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

  if (!product || !product.approved) notFound()

  const postedDate = new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(product.createdAt))

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Products
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Image */}
          <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <Package size={80} className="text-gray-300" />
            )}
          </div>

          {/* Details */}
          <div className="p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                <Tag size={11} />
                {product.category.name}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>

            <p className="text-gray-600 text-sm leading-relaxed mb-6">{product.description}</p>

            <div className="mb-6">
              <span className="text-3xl font-bold text-green-700">
                ₱{product.price.toFixed(2)}
              </span>
              <span className="text-sm text-gray-400 ml-2">/ {product.unit}</span>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-500">Available stock</span>
                <span
                  className={`font-medium ${product.stock > 0 ? 'text-green-700' : 'text-red-500'}`}
                >
                  {product.stock > 0
                    ? `${parseFloat(product.stock.toFixed(2))} ${product.unit}`
                    : 'Out of stock'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-1">
                  <User size={14} /> Farmer
                </span>
                <Link
                  href={`/sellers/${product.farmer.id}`}
                  className="font-medium text-green-700 hover:underline"
                >
                  {product.farmer.name}
                </Link>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 flex items-center gap-1">
                  <CalendarDays size={14} /> Listed on
                </span>
                <span className="text-gray-600">{postedDate}</span>
              </div>
            </div>

            <div className="mt-auto space-y-3">
              <AddToCartButton
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                  unit: product.unit,
                  farmerId: product.farmer.id,
                  farmerName: product.farmer.name,
                }}
              />
              <Link
                href="/products"
                className="block w-full text-center border border-gray-300 text-gray-600 hover:border-green-500 hover:text-green-700 font-medium py-3 rounded-xl text-sm transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>

      <ReviewsSection productId={productId} />
    </div>
  )
}
