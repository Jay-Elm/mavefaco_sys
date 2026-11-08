'use client'

import { useState, type ReactNode } from 'react'

/**
 * Keeps a form folded away behind one button until it's needed. Used for
 * the email, password and delete-account forms so browsers have no password
 * box to fill when the profile page opens.
 */
export default function RevealForm({
  label,
  danger = false,
  children,
}: {
  label: string
  danger?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
          danger
            ? 'border-red-300 text-red-700 hover:bg-red-50'
            : 'border-gray-300 text-soil hover:bg-gray-50'
        }`}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      {children}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 text-sm text-gray-500 hover:text-soil underline underline-offset-2"
      >
        Cancel
      </button>
    </div>
  )
}
