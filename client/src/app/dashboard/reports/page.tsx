'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, TrendingUp, Leaf, Users, BarChart2, Download, Printer } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportData {
  summary: {
    totalRevenue: number
    totalOrders: number
    totalUsers: number
    totalProducts: number
    approvedProducts: number
  }
  salesByMonth: { month: string; orders: number; revenue: number }[]
  ordersByStatus: { status: string; count: number }[]
  usersByRole: { role: string; count: number }[]
  topProducts: { name: string; category: string; farmer: string; unitsSold: number; revenue: number }[]
  salesByCategory: { category: string; unitsSold: number; revenue: number }[]
  farmerPerformance: { id: number; name: string; email: string; productCount: number; unitsSold: number; revenue: number }[]
}

type Tab = 'sales' | 'products' | 'users' | 'farmers'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const peso = (n: number) => `₱${n.toFixed(2)}`

function formatMonth(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-PH', {
    month: 'short',
    year: 'numeric',
  })
}

function triggerDownload(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadFullReport(data: ReportData) {
  const e = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const row = (...cells: (string | number)[]) => cells.map(e).join(',')
  const lines: string[] = []

  const avgOrder = data.summary.totalOrders > 0
    ? data.summary.totalRevenue / data.summary.totalOrders : 0
  const deliveredCount = data.ordersByStatus.find((s) => s.status === 'delivered')?.count ?? 0
  const deliveryRate = data.summary.totalOrders > 0
    ? (deliveredCount / data.summary.totalOrders) * 100 : 0

  lines.push(row('CoopMarket Full Report', `Generated: ${new Date().toLocaleDateString('en-PH')}`))
  lines.push('')

  lines.push(e('SALES SUMMARY'))
  lines.push(row('Metric', 'Value'))
  lines.push(row('Total Revenue (PHP)', data.summary.totalRevenue.toFixed(2)))
  lines.push(row('Total Orders', data.summary.totalOrders))
  lines.push(row('Average Order Value (PHP)', avgOrder.toFixed(2)))
  lines.push(row('Delivery Rate (%)', deliveryRate.toFixed(1)))
  lines.push('')

  lines.push(e('MONTHLY BREAKDOWN'))
  lines.push(row('Month', 'Orders', 'Revenue (PHP)'))
  for (const r of data.salesByMonth)
    lines.push(row(formatMonth(r.month), r.orders, r.revenue.toFixed(2)))
  lines.push('')

  lines.push(e('ORDERS BY STATUS'))
  lines.push(row('Status', 'Count'))
  for (const r of data.ordersByStatus)
    lines.push(row(r.status, r.count))
  lines.push('')

  lines.push(e('TOP PRODUCTS BY UNITS SOLD'))
  lines.push(row('Rank', 'Product', 'Category', 'Farmer', 'Units Sold', 'Revenue (PHP)'))
  data.topProducts.forEach((p, i) =>
    lines.push(row(i + 1, p.name, p.category, p.farmer, p.unitsSold, p.revenue.toFixed(2)))
  )
  lines.push('')

  lines.push(e('REVENUE BY CATEGORY'))
  lines.push(row('Category', 'Units Sold', 'Revenue (PHP)'))
  for (const r of data.salesByCategory)
    lines.push(row(r.category, r.unitsSold, r.revenue.toFixed(2)))
  lines.push('')

  lines.push(e('USERS BY ROLE'))
  lines.push(row('Role', 'Count'))
  for (const r of data.usersByRole)
    lines.push(row(r.role, r.count))
  lines.push('')

  lines.push(e('FARMER PERFORMANCE'))
  lines.push(row('Farmer', 'Email', 'Products Listed', 'Units Sold', 'Revenue (PHP)'))
  for (const f of data.farmerPerformance)
    lines.push(row(f.name, f.email, f.productCount, f.unitsSold, f.revenue.toFixed(2)))

  triggerDownload(`coopmarket-report-${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'))
}

// ─── Bar row component ────────────────────────────────────────────────────────

function BarRow({
  label, value, max, format, color = 'bg-green-500',
}: {
  label: string
  value: number
  max: number
  format?: (v: number) => string
  color?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="w-36 text-sm text-gray-600 text-right shrink-0 capitalize truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-5">
        {pct > 0 && (
          <div
            className={`${color} h-5 rounded-full`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        )}
      </div>
      <span className="w-32 text-sm font-semibold text-gray-800 shrink-0 text-right">
        {format ? format(value) : value.toLocaleString()}
      </span>
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-400',
  confirmed: 'bg-blue-400',
  shipped:   'bg-purple-400',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-400',
}

const ROLE_COLORS: Record<string, string> = {
  customer: 'bg-blue-400',
  farmer:   'bg-green-500',
  manager:  'bg-purple-400',
  admin:    'bg-red-400',
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'sales',    label: 'Sales',        icon: TrendingUp },
  { id: 'products', label: 'Crop Demand',  icon: Leaf },
  { id: 'users',    label: 'Users',        icon: Users },
  { id: 'farmers',  label: 'Farmers',      icon: BarChart2 },
]

export default function ReportsPage() {
  const { token } = useAuth()
  const [data, setData]     = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [tab, setTab]       = useState<Tab>('sales')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Failed to load reports'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  if (error) return <div className="p-8 text-red-600 text-sm">{error}</div>
  if (!data) return null

  const { summary, salesByMonth, ordersByStatus, usersByRole, topProducts, salesByCategory, farmerPerformance } = data

  const maxMonthRevenue = Math.max(0, ...salesByMonth.map((r) => r.revenue))
  const maxStatusCount  = Math.max(0, ...ordersByStatus.map((r) => r.count))
  const maxRoleCount    = Math.max(0, ...usersByRole.map((r) => r.count))
  const maxCatRevenue   = Math.max(0, ...salesByCategory.map((r) => r.revenue))

  const avgOrderValue = summary.totalOrders > 0 ? summary.totalRevenue / summary.totalOrders : 0
  const deliveredCount = ordersByStatus.find((s) => s.status === 'delivered')?.count ?? 0
  const deliveryRate = summary.totalOrders > 0 ? (deliveredCount / summary.totalOrders) * 100 : 0

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mr-auto">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadFullReport(data)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors"
          >
            <Download size={14} />
            Export Full Report
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6">
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      </div>

      {/* ── Sales tab ──────────────────────────────────────────────────────── */}
      {tab === 'sales' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: peso(summary.totalRevenue), sub: 'from delivered orders' },
              { label: 'Total Orders',  value: summary.totalOrders.toLocaleString(), sub: 'all statuses' },
              { label: 'Avg Order Value', value: peso(avgOrderValue), sub: 'per order placed' },
              { label: 'Delivery Rate', value: `${deliveryRate.toFixed(1)}%`, sub: `${deliveredCount} delivered` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Monthly breakdown */}
          <Section title="Monthly Breakdown">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'sales-monthly.csv',
                  ['Month', 'Orders', 'Revenue (₱)'],
                  salesByMonth.map((r) => [formatMonth(r.month), r.orders, r.revenue.toFixed(2)])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>

            {salesByMonth.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No order data yet</p>
            ) : (
              <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                <div className="grid grid-cols-[8rem_4rem_8rem_1fr] gap-4 pb-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <span>Month</span>
                  <span className="text-center">Orders</span>
                  <span className="text-right">Revenue</span>
                  <span className="pl-1">Scale</span>
                </div>
                {salesByMonth.map((row) => {
                  const pct = maxMonthRevenue > 0 ? (row.revenue / maxMonthRevenue) * 100 : 0
                  return (
                    <div
                      key={row.month}
                      className="grid grid-cols-[8rem_4rem_8rem_1fr] gap-4 items-center py-2.5 border-b border-gray-50"
                    >
                      <span className="text-sm text-gray-700">{formatMonth(row.month)}</span>
                      <span className="text-sm text-center text-gray-600">{row.orders}</span>
                      <span className="text-sm text-right font-semibold text-green-700">{peso(row.revenue)}</span>
                      <div className="bg-gray-100 rounded-full h-4">
                        {pct > 0 && (
                          <div
                            className="bg-green-500 h-4 rounded-full"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            )}
          </Section>

          {/* Orders by status */}
          <Section title="Orders by Status">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'orders-by-status.csv',
                  ['Status', 'Count'],
                  ordersByStatus.map((r) => [r.status, r.count])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>
            {ordersByStatus.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No orders yet</p>
            ) : (
              <div className="space-y-1">
                {ordersByStatus.map((row) => (
                  <BarRow
                    key={row.status}
                    label={row.status}
                    value={row.count}
                    max={maxStatusCount}
                    color={STATUS_COLORS[row.status] ?? 'bg-gray-400'}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── Crop Demand tab ────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-6">
          {/* Top 10 products */}
          <Section title="Top 10 Products by Units Sold">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'crop-demand.csv',
                  ['Rank', 'Product', 'Category', 'Farmer', 'Units Sold', 'Revenue (₱)'],
                  topProducts.map((p, i) => [i + 1, p.name, p.category, p.farmer, p.unitsSold, p.revenue.toFixed(2)])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No order data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="pb-3 text-left w-8">#</th>
                      <th className="pb-3 text-left">Product</th>
                      <th className="pb-3 text-left">Category</th>
                      <th className="pb-3 text-left">Farmer</th>
                      <th className="pb-3 text-right">Units Sold</th>
                      <th className="pb-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {topProducts.map((p, i) => (
                      <tr key={p.name} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="py-3 font-medium text-gray-900">{p.name}</td>
                        <td className="py-3">
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                            {p.category}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">{p.farmer}</td>
                        <td className="py-3 text-right font-semibold text-gray-800">{p.unitsSold}</td>
                        <td className="py-3 text-right font-semibold text-green-700">{peso(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Sales by category */}
          <Section title="Revenue by Category">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'revenue-by-category.csv',
                  ['Category', 'Units Sold', 'Revenue (PHP)'],
                  salesByCategory.map((r) => [r.category, r.unitsSold, r.revenue.toFixed(2)])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>
            {salesByCategory.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No order data yet</p>
            ) : (
              <div className="space-y-1">
                {salesByCategory.map((row) => (
                  <BarRow
                    key={row.category}
                    label={row.category}
                    value={row.revenue}
                    max={maxCatRevenue}
                    format={peso}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── Users tab ──────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Total Users',    value: summary.totalUsers },
              { label: 'Total Products', value: summary.totalProducts },
              { label: 'Approved',       value: summary.approvedProducts },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <Section title="Users by Role">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'users-by-role.csv',
                  ['Role', 'Count'],
                  usersByRole.map((r) => [r.role, r.count])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>

            {usersByRole.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No users yet</p>
            ) : (
              <div className="space-y-1">
                {usersByRole.map((row) => (
                  <BarRow
                    key={row.role}
                    label={row.role}
                    value={row.count}
                    max={maxRoleCount}
                    color={ROLE_COLORS[row.role] ?? 'bg-gray-400'}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* ── Farmers tab ────────────────────────────────────────────────────── */}
      {tab === 'farmers' && (
        <div className="space-y-6">
          <Section title="Farmer Performance">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => downloadCSV(
                  'farmer-performance.csv',
                  ['Farmer', 'Email', 'Products Listed', 'Units Sold', 'Revenue (₱)'],
                  farmerPerformance.map((f) => [f.name, f.email, f.productCount, f.unitsSold, f.revenue.toFixed(2)])
                )}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors"
              >
                <Download size={12} /> Download CSV
              </button>
            </div>

            {farmerPerformance.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No farmers registered yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <th className="pb-3 text-left">Farmer</th>
                      <th className="pb-3 text-center">Products</th>
                      <th className="pb-3 text-center">Units Sold</th>
                      <th className="pb-3 text-right">Revenue</th>
                      <th className="pb-3 text-left pl-4">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {farmerPerformance.map((f) => {
                      const maxRev = Math.max(1, ...farmerPerformance.map((x) => x.revenue))
                      const pct = (f.revenue / maxRev) * 100
                      return (
                        <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3">
                            <p className="font-medium text-gray-900">{f.name}</p>
                            <p className="text-xs text-gray-400">{f.email}</p>
                          </td>
                          <td className="py-3 text-center text-gray-600">{f.productCount}</td>
                          <td className="py-3 text-center text-gray-600">{f.unitsSold}</td>
                          <td className="py-3 text-right font-semibold text-green-700">{peso(f.revenue)}</td>
                          <td className="py-3 pl-4">
                            <div className="w-32 bg-gray-100 rounded-full h-3">
                              {pct > 0 && (
                                <div
                                  className="bg-green-500 h-3 rounded-full"
                                  style={{ width: `${Math.max(pct, 2)}%` }}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
