import Link from 'next/link'
import { Leaf, ArrowLeft, ShoppingBag } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 bg-white">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-[#1B3A2D] rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Leaf size={28} className="text-green-300" />
        </div>

        <p className="font-serif text-8xl font-bold text-gray-100 leading-none select-none mb-4">404</p>

        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-3">
          This page doesn&apos;t exist
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          The page you&apos;re looking for may have been moved, deleted, or never existed. Let&apos;s get you back on track.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1B3A2D] hover:bg-[#2E6649] text-white font-medium rounded-lg transition-colors text-sm"
          >
            <ArrowLeft size={15} />
            Back to home
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors text-sm"
          >
            <ShoppingBag size={15} />
            Browse products
          </Link>
        </div>
      </div>
    </div>
  )
}
