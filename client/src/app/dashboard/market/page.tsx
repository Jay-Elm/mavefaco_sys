'use client'

import MarketBoard from '@/components/market/MarketBoard'

/** Staff Market page: demand against planned harvests, alerts, crops to recommend. */
export default function StaffMarketPage() {
  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-soil mb-4">Market</h1>
      <MarketBoard forStaff />
    </div>
  )
}
