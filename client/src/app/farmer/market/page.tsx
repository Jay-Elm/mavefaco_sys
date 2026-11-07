'use client'

import MarketBoard from '@/components/market/MarketBoard'

/** Farmer Market page: what's selling, what members plan to harvest, what's worth planting. */
export default function FarmerMarketPage() {
  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-soil mb-4">Market</h1>
      <MarketBoard forStaff={false} />
    </div>
  )
}
