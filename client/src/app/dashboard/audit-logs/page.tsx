'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, ScrollText } from 'lucide-react'

interface AuditLog {
  id: number
  action: string
  entityType: string
  entityId: number
  timestamp: string
  user: { id: number; name: string; email: string; role: string }
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_PRODUCT: 'bg-green-100 text-green-800',
  DELETE_PRODUCT: 'bg-red-100 text-red-800',
  UPDATE_ORDER_STATUS: 'bg-blue-100 text-blue-800',
}

export default function AuditLogsPage() {
  const { token } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setLogs(data)
      })
      .catch(() => setError('Failed to load audit logs'))
      .finally(() => setLoading(false))
  }, [token])

  const filtered = logs.filter(
    (log) =>
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.user.name.toLowerCase().includes(search.toLowerCase()) ||
      log.entityType.toLowerCase().includes(search.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <span className="text-sm text-gray-500">{logs.length} entries (last 100)</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by action, user, or entity…"
          className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Action</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Entity</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Performed by</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-gray-400">
                  <ScrollText size={32} className="mx-auto mb-2" />
                  {search ? 'No matching logs' : 'No audit logs yet'}
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">
                    {log.entityType} #{log.entityId}
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-gray-900">{log.user.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{log.user.role}</p>
                  </td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {new Intl.DateTimeFormat('en-PH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(log.timestamp))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
