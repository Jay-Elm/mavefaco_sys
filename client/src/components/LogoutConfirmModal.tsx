'use client'

import { LogOut, X } from 'lucide-react'

// Matches the branding already used in each role's own layout (Farmer
// Portal, Admin Panel, Manager Panel) so the prompt feels like part of
// that context rather than a generic system dialog.
const ROLE_COPY: Record<string, string> = {
  admin: 'Log out of the Admin Panel?',
  manager: 'Log out of the Manager Panel?',
  farmer: 'Log out of your Farmer Portal account?',
  customer: 'Log out of your CoopMarket account?',
}

export default function LogoutConfirmModal({
  role,
  onConfirm,
  onCancel,
}: {
  role?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const message = (role && ROLE_COPY[role]) ?? 'Log out of your account?'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Log Out</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Cancel">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            autoFocus
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            <LogOut size={14} />
            Log Out
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
