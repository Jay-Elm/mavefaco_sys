'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Leaf, RotateCcw, ArrowLeft } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 bg-white">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-[#1B3A2D] rounded-2xl flex items-center justify-center mx-auto mb-8">
          <Leaf size={28} className="text-green-300" />
        </div>

        <h1 className="font-serif text-2xl font-bold text-gray-900 mb-3">
          Something went wrong
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          An unexpected error occurred. You can try reloading the page, or head back to the homepage.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1B3A2D] hover:bg-[#2E6649] text-white font-medium rounded-lg transition-colors text-sm"
          >
            <RotateCcw size={15} />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors text-sm"
          >
            <ArrowLeft size={15} />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
