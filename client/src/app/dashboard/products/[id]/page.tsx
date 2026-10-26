'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Loader2, Package, AlertTriangle } from 'lucide-react'
import { reasonLabels, suspensionDeadline } from '@/validators/productSuspension'
import ReviewsSection from '@/components/ReviewsSection'

interface Product {
  id: number
  name: string
  description: string
  price: number
  stock: number
  unit: string
  imageUrl: string | null
  approved: boolean
  createdAt: string
  updatedAt: string
  suspendedAt: string | null
  suspensionReasons: string[]
  suspensionNote: string | null
  category: { name: string }
  farmer: { id: number; name: string; email: string }
}

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

/** Read-only view of a listing for staff. Staff don't edit listings; they approve or suspend them. */
export default function DashboardProductViewPage() {
  const { token } = useAuth()
  const params = useParams()
  const productId = params.id as string

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch(`/api/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setProduct(d)))
      .catch(() => setError('Failed to load product'))
      .finally(() => setLoading(false))
  }, [token, productId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/dashboard/products" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-forest mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Products
      </Link>

      {error || !product ? (
        <div className="text-red-600 text-sm">{error || 'Product not found'}</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {product.suspendedAt && (
            <div className="bg-red-50 border-b border-red-200 px-5 py-4 text-sm text-red-800">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={15} />
                Suspended {fmtDate(product.suspendedAt)}; deleted automatically after {fmtDate(suspensionDeadline(product.suspendedAt))} unless resubmitted
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-0.5">
                {reasonLabels(product.suspensionReasons).map((r) => <li key={r}>{r}</li>)}
              </ul>
              {product.suspensionNote && <p className="mt-2">Note: {product.suspensionNote}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
            <div className="aspect-square bg-gray-100 relative flex items-center justify-center">
              {product.imageUrl ? (
                <Image src={product.imageUrl} alt={product.name} fill unoptimized className="object-cover" />
              ) : (
                <Package size={48} className="text-gray-300" />
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">{product.category.name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  product.suspendedAt ? 'bg-red-100 text-red-700' : product.approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {product.suspendedAt ? 'Suspended' : product.approved ? 'Approved' : 'Pending'}
                </span>
              </div>
              <h1 className="font-serif text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="text-gray-600 text-sm mt-2 whitespace-pre-line">{product.description || 'No description'}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 border-t border-gray-100 text-sm">
            <div><dt className="text-gray-500">Price</dt><dd className="font-semibold text-green-700">₱{product.price.toFixed(2)} per {product.unit}</dd></div>
            <div><dt className="text-gray-500">Stock</dt><dd className="text-gray-900">{product.stock} {product.unit}</dd></div>
            <div><dt className="text-gray-500">Farmer</dt><dd className="text-gray-900">{product.farmer.name} <span className="text-gray-400">({product.farmer.email})</span></dd></div>
            <div><dt className="text-gray-500">Listed</dt><dd className="text-gray-900">{fmtDate(product.createdAt)}</dd></div>
            <div><dt className="text-gray-500">Last updated</dt><dd className="text-gray-900">{fmtDate(product.updatedAt)}</dd></div>
          </dl>
        </div>
      )}

      {/* Staff can remove reviews here; the storefront product page is for shoppers. */}
      {product && <ReviewsSection productId={product.id} />}
    </div>
  )
}
