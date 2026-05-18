'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Package, ShoppingCart, TrendingUp, Plus, AlertTriangle, CloudRain, Bug, Flame } from 'lucide-react'
import WeatherWidget from '@/components/WeatherWidget'

const LOW_STOCK_THRESHOLD = 5

interface Stats {
  productCount: number
  orderCount: number
  totalRevenue: number
  outOfStock: number
  lowStock: number
}

interface AdvisoryLog {
  id: number
  type: string
  note: string
  createdAt: string
  product: { name: string; category: { name: string } }
}

const LOG_TYPE_INFO: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  weather_impact: { label: 'Weather', icon: CloudRain, cls: 'text-blue-500' },
  pest_disease:   { label: 'Pest/Disease', icon: Bug,       cls: 'text-red-500' },
  damage:         { label: 'Damage',   icon: Flame,     cls: 'text-orange-500' },
}

export default function FarmerOverviewPage() {
  const { token, user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [advisory, setAdvisory] = useState<AdvisoryLog[]>([])

  useEffect(() => {
    if (!token || !user) return

    fetch('/api/farmer/advisory', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAdvisory(d) })

    Promise.all([
      fetch(`/api/products?farmerId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/farmer/orders', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([products, orders]) => {
        const productList = Array.isArray(products) ? products : []
        const productCount = productList.length
        const orderList = Array.isArray(orders) ? orders : []
        const orderCount = orderList.length
        // Revenue = sum of own items in delivered orders only
        const totalRevenue = orderList
          .filter((o: { status: string }) => o.status === 'delivered')
          .reduce((sum: number, o: { items: { price: number; quantity: number }[] }) =>
            sum + (o.items ?? []).reduce((s, item) => s + item.price * item.quantity, 0), 0)
        const outOfStock = productList.filter((p: { stock: number }) => p.stock === 0).length
        const lowStock = productList.filter((p: { stock: number }) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length
        setStats({ productCount, orderCount, totalRevenue, outOfStock, lowStock })
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

      {/* Stock alerts */}
      {((stats?.outOfStock ?? 0) > 0 || (stats?.lowStock ?? 0) > 0) && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            {(stats?.outOfStock ?? 0) > 0 && (
              <p>
                <span className="font-semibold">{stats!.outOfStock} product{stats!.outOfStock > 1 ? 's' : ''} out of stock</span>
                {' '}— customers cannot order these.
              </p>
            )}
            {(stats?.lowStock ?? 0) > 0 && (
              <p>
                <span className="font-semibold">{stats!.lowStock} product{stats!.lowStock > 1 ? 's' : ''} running low</span>
                {' '}(≤ {LOW_STOCK_THRESHOLD} units remaining).
              </p>
            )}
            <p className="text-amber-600">
              <a href="/farmer/products" className="underline hover:no-underline">Go to My Products</a> to restock.
            </p>
          </div>
        </div>
      )}

      {/* Weather widget */}
      <div className="mb-6">
        <WeatherWidget />
      </div>

      {/* Community advisory */}
      {advisory.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Bug size={15} className="text-red-500" /> Community Advisory (last 30 days)
          </h2>
          <div className="space-y-2">
            {advisory.slice(0, 5).map((log) => {
              const info = LOG_TYPE_INFO[log.type]
              const Icon = info?.icon ?? Bug
              return (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <Icon size={14} className={`shrink-0 mt-0.5 ${info?.cls ?? 'text-gray-500'}`} />
                  <div>
                    <span className="font-medium text-gray-700">{log.product.category.name}</span>
                    <span className="text-gray-500 mx-1">—</span>
                    <span className="text-gray-600">{log.note}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(log.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
