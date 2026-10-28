import { Suspense } from 'react'
import { Leaf, Loader2 } from 'lucide-react'
import VerifyEmailStatus from './VerifyEmailStatus'

function LoadingFallback() {
  return (
    <div className="bg-white rounded-card shadow-sm border border-gray-200 p-6 flex justify-center">
      <Loader2 size={24} className="animate-spin text-paddy" />
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-shoot p-3 rounded-full">
              <Leaf size={28} className="text-paddy" />
            </div>
          </div>
          <h1 className="font-display text-4xl font-bold text-soil">Verify your email</h1>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <VerifyEmailStatus />
        </Suspense>
      </div>
    </div>
  )
}
