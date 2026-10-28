'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Bug, Loader2 } from 'lucide-react'
import AdvisoryList from '@/components/AdvisoryList'
import type { AdvisoryGroup } from '@/lib/advisory'

export default function AdvisoryPage() {
  const { token } = useAuth()
  const [groups, setGroups] = useState<AdvisoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/farmer/advisory', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setGroups(d) : setError(d.error ?? 'Failed to load the advisory')))
      .catch(() => setError('Failed to load the advisory'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/farmer" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-paddy mb-6">
        <ArrowLeft size={15} /> Back to Overview
      </Link>
      <div className="flex items-center gap-3 mb-2">
        <Bug size={20} className="text-red-500" />
        <h1 className="text-2xl font-bold text-soil">Community Advisory</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Pest, weather and damage reports from members over the last 30 days, grouped by crop and problem.
        Reports are shared by crop only, never by farm.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-2">
        {groups.length === 0 && !error
          ? <p className="text-sm text-gray-500 py-6 text-center">No reports from members in the last 30 days.</p>
          : <AdvisoryList groups={groups} />}
      </div>
    </div>
  )
}
