'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Users, Package, ShoppingCart, TrendingUp, Loader2, Leaf, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Stats {
  userCount: number
  approvedProductCount: number
  pendingProductCount: number
  orderCount: number
  totalRevenue: number
  recentOrders: {
    id: number
    status: string
    totalAmount: number
    createdAt: string
    customer: { name: string; email: string }
  }[]
}

interface FarmerStat {
  id: number
  name: string
  email: string
  verified: boolean
  suspended: boolean
  productCount: number
  approvedCount: number
  pendingCount: number
  totalOrderItems: number
  totalRevenue: number
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function DashboardOverviewPage() {
  const { token, user } = useAuth()
  const isManager = user?.role === 'manager'

  const [stats, setStats] = useState<Stats | null>(null)
  const [farmerStats, setFarmerStats] = useState<FarmerStat[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (data.error) setError(data.error); else setStats(data) })
      .catch(() => setError('Failed to load stats'))
  }, [token])

  useEffect(() => {
    if (!token || !isManager) return
    fetch('/api/admin/farmer-stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (!data.error) setFarmerStats(data) })
      .catch(() => {})
  }, [token, isManager])

  if (error) return <div className="p-8 text-red-600">{error}</div>

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="bg-blue-500 text-white p-3 rounded-lg"><Users size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.userCount}</p>
            <p className="text-sm text-gray-500">Total Users</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="bg-green-500 text-white p-3 rounded-lg"><Package size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.approvedProductCount + stats.pendingProductCount}</p>
            <p className="text-sm text-gray-500">Products</p>
            <p className="text-xs mt-0.5">
              <span className="text-green-600 font-medium">{stats.approvedProductCount} approved</span>
              <span className="text-gray-400"> · </span>
              {stats.pendingProductCount > 0 ? (
                <span className="text-amber-600 font-medium inline-flex items-center gap-0.5">
                  <AlertCircle size={10} />{stats.pendingProductCount} pending
                </span>
              ) : (
                <span className="text-gray-400">0 pending</span>
              )}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="bg-orange-500 text-white p-3 rounded-lg"><ShoppingCart size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.orderCount}</p>
            <p className="text-sm text-gray-500">Total Orders</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
          <div className="bg-purple-500 text-white p-3 rounded-lg"><TrendingUp size={22} /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">₱{stats.totalRevenue.toFixed(2)}</p>
            <p className="text-sm text-gray-500">Total Revenue</p>
          </div>
        </div>
      </div>

      {/* Manager: Farmer Performance Table */}
      {isManager && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Leaf size={18} className="text-green-600" />
            <h2 className="font-semibold text-gray-900">Farmer Performance</h2>
          </div>
          {farmerStats.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No farmers registered yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Farmer</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-500">Products</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-500">Approved</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-500">Pending</th>
                    <th className="px-5 py-3 text-center font-medium text-gray-500">Orders</th>
                    <th className="px-5 py-3 text-right font-medium text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {farmerStats.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.email}</p>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {f.suspended ? (
                          <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Suspended</span>
                        ) : f.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <CheckCircle size={11} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                            <Clock size={11} /> Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center text-gray-700">{f.productCount}</td>
                      <td className="px-5 py-3 text-center text-green-700 font-medium">{f.approvedCount}</td>
                      <td className="px-5 py-3 text-center text-yellow-700 font-medium">{f.pendingCount}</td>
                      <td className="px-5 py-3 text-center text-gray-700">{f.totalOrderItems}</td>
                      <td className="px-5 py-3 text-right font-semibold text-green-700">
                        ₱{f.totalRevenue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Orders</h2>
        </div>
        {stats.recentOrders.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No orders yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{order.customer.name}</p>
                  <p className="text-xs text-gray-400">{order.customer.email}</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {order.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    ₱{order.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
