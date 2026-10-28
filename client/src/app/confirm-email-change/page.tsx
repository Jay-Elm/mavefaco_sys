import { Suspense } from 'react'
import { Loader2, Mail } from 'lucide-react'
import ConfirmEmailChangeStatus from './ConfirmEmailChangeStatus'

function LoadingFallback() {
  return (
    <div className="bg-white rounded-card shadow-sm border border-gray-200 p-6 flex justify-center">
      <Loader2 size={24} className="animate-spin text-paddy-deep" />
    </div>
  )
}

export default function ConfirmEmailChangePage() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12 bg-field">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-white p-3 rounded-full">
              <Mail size={28} className="text-paddy" />
            </div>
          </div>
          <h1 className="font-display text-4xl font-bold text-soil">Confirm your new email</h1>
        </div>

        <Suspense fallback={<LoadingFallback />}>
          <ConfirmEmailChangeStatus />
        </Suspense>
      </div>
    </div>
  )
}
