'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Bug, Loader2, Megaphone } from 'lucide-react'
import AdvisoryList from '@/components/AdvisoryList'
import type { AdvisoryGroup } from '@/lib/advisory'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'

/** What members reported from their fields in the last 30 days, as farmers see it. */
export default function StaffAdvisoryPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const [groups, setGroups] = useState<AdvisoryGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/advisory', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setGroups(d) : setError(d.error ?? 'Failed to load the advisory')))
      .catch(() => setError('Failed to load the advisory'))
      .finally(() => setLoading(false))
  }, [token, live])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  const farms = Math.max(0, ...groups.map((g) => g.farms))

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <Bug size={20} className="text-red-500" />
        <h1 className="text-2xl font-bold text-soil">Crop Advisory</h1>
        <Link
          href="/dashboard/announcements"
          className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-soil border border-gray-300 rounded-lg px-3 py-1.5"
        >
          <Megaphone size={12} /> Post an advisory to farmers
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Pest, weather and damage reports from members over the last 30 days, grouped by crop and kind of problem,
        exactly as farmers see them in their portal. Farms are counted, never named.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {groups.length > 0 && (
        <p className="text-sm text-gray-700 mb-3">
          {groups.length} {groups.length === 1 ? 'problem' : 'problems'} reported
          {farms > 1 && <>; the most widespread on {farms} farms</>}.
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-2">
        {groups.length === 0 && !error
          ? <p className="text-sm text-gray-500 py-6 text-center">No reports from members in the last 30 days.</p>
          : <AdvisoryList groups={groups} />}
      </div>
    </div>
  )
}
