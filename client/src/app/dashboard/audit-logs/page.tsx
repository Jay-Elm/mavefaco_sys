'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, ScrollText, Search, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

interface AuditLog {
  id: number
  action: string
  entityType: string
  entityId: number
  timestamp: string
  user: { id: number; name: string; email: string; role: string }
}

const ACTION_COLORS: Record<string, string> = {
  CREATE_PRODUCT:      'bg-green-100 text-green-800',
  DELETE_PRODUCT:      'bg-red-100 text-red-800',
  UPDATE_ORDER_STATUS: 'bg-blue-100 text-blue-800',
}

export default function AuditLogsPage() {
  const { token } = useAuth()
  const [logs, setLogs]       = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [search, setSearch]           = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterEntity, setFilterEntity] = useState('')

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

  const actions     = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs])
  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entityType))].sort(), [logs])

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (search) {
        const q = search.toLowerCase()
        const match =
          log.action.toLowerCase().includes(q) ||
          log.user.name.toLowerCase().includes(q) ||
          log.entityType.toLowerCase().includes(q)
        if (!match) return false
      }
      if (filterAction && log.action !== filterAction) return false
      if (filterEntity && log.entityType !== filterEntity) return false
      return true
    })
  }, [logs, search, filterAction, filterEntity])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  const activeFilters = search || filterAction || filterEntity

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <span className="text-sm text-gray-500">{logs.length} entries (last 100)</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by action, user, or entity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All entities</option>
          {entityTypes.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        {activeFilters && (
          <button
            onClick={() => { setSearch(''); setFilterAction(''); setFilterEntity('') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {logs.length} entries
        </span>
        <button
          onClick={() => downloadCSV(
            'audit-logs.csv',
            ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Performed By', 'Email', 'Role'],
            filtered.map((log) => [
              new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(log.timestamp)),
              log.action, log.entityType, log.entityId,
              log.user.name, log.user.email, log.user.role,
            ])
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
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
                  {logs.length === 0 ? 'No audit logs yet' : 'No logs match your filters'}
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
    </div>
  )
}
