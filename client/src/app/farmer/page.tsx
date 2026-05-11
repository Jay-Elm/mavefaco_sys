'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Package, ShoppingCart, TrendingUp, Plus } from 'lucide-react'

interface Stats {
  productCount: number
  orderCount: number
  totalRevenue: number
}

export default function FarmerOverviewPage() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !user) return

    Promise.all([
      fetch(`/api/products?farmerId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/farmer/orders', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([products, orders]) => {
        const productCount = Array.isArray(products) ? products.length : 0
        const orderCount = Array.isArray(orders) ? orders.length : 0
        const totalRevenue = Array.isArray(orders)
          ? orders.reduce((sum: number, o: { totalAmount: number }) => sum + o.totalAmount, 0)
          : 0
        setStats({ productCount, orderCount, totalRevenue })
      })
      .finally(() => setLoading(false))
  }, [token, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Your farm at a glance</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">My Products</span>
            <Package size={18} className="text-green-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.productCount ?? 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Orders</span>
            <ShoppingCart size={18} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.orderCount ?? 0}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total Revenue</span>
            <TrendingUp size={18} className="text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ₱{(stats?.totalRevenue ?? 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/farmer/products/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors"
        >
          <Plus size={16} />
          Add Product
        </Link>
        <Link
          href="/farmer/orders"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ShoppingCart size={16} />
          View Orders
        </Link>
      </div>
    </div>
  )
}
