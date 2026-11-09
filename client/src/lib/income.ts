/**
 * Expected income from a planting: its yield in kilos times a price per kilo.
 *
 * Two prices are used, and both are shown when known:
 *   own  the farmer's own price per kilo: the planting's linked listing (if
 *        it is for the same crop, or not tied to a crop yet), or
 *        else their most recently updated live listing of the same crop
 *        (listings sold by the kilo only; other units can't be compared)
 *   psa  the latest PSA farmgate price for Albay, or Bicol when PSA has
 *        none for Albay. Farmgate is what traders pay at the farm, so this
 *        is the lower, wholesale figure.
 *
 * It is an estimate: it assumes the whole yield is sold at that price.
 * Growing plantings use the expected yield; harvested ones the actual
 * yield when recorded. Failed plantings have none.
 */

export interface PriceUsed {
  pricePerKg: number
  amount: number
}
export interface OwnPrice extends PriceUsed {
  listing: { id: number; name: string }
}
export interface PsaPrice extends PriceUsed {
  area: 'albay' | 'bicol'
  month: string // YYYY-MM
}

export interface IncomeEstimate {
  kg: number
  basis: 'expected' | 'actual'
  own: OwnPrice | null
  psa: PsaPrice | null
}

export interface OwnPriceSource { listing: { id: number; name: string }; pricePerKg: number }
export interface PsaPriceSource { area: 'albay' | 'bicol'; month: string; pricePerKg: number }

const pesos = (n: number) => Math.round(n * 100) / 100

/** The kilos an estimate is based on, or null when there is nothing to estimate. */
export function estimateBasis(p: {
  status: string
  expectedYield: number | null
  actualYield: number | null
}): { kg: number; basis: 'expected' | 'actual' } | null {
  if (p.status === 'failed') return null
  if (p.status === 'harvested' && p.actualYield !== null && p.actualYield > 0) return { kg: p.actualYield, basis: 'actual' }
  if (p.expectedYield !== null && p.expectedYield > 0) return { kg: p.expectedYield, basis: 'expected' }
  return null
}

export function incomeEstimate(
  p: { status: string; expectedYield: number | null; actualYield: number | null },
  own: OwnPriceSource | null,
  psa: PsaPriceSource | null,
): IncomeEstimate | null {
  const basis = estimateBasis(p)
  if (!basis) return null
  return {
    ...basis,
    own: own && own.pricePerKg > 0 ? { listing: own.listing, pricePerKg: own.pricePerKg, amount: pesos(basis.kg * own.pricePerKg) } : null,
    psa: psa && psa.pricePerKg > 0 ? { area: psa.area, month: psa.month, pricePerKg: psa.pricePerKg, amount: pesos(basis.kg * psa.pricePerKg) } : null,
  }
}

/** The single figure used in totals: the farmer's own price when known, else PSA's. */
export function bestAmount(e: IncomeEstimate | null): number | null {
  if (!e) return null
  return e.own?.amount ?? e.psa?.amount ?? null
}

/**
 * Expected income from the plantings still growing: the total of their
 * best figures, and how many growing plantings couldn't be counted
 * (no expected yield, or no price for the crop yet).
 */
export function expectedIncomeTotal(plantings: { status: string; income: IncomeEstimate | null }[]) {
  let total = 0
  let counted = 0
  let missing = 0
  for (const p of plantings) {
    if (p.status !== 'growing') continue
    const amount = bestAmount(p.income)
    if (amount === null) missing++
    else { total += amount; counted++ }
  }
  return { total: pesos(total), counted, missing }
}

export const PSA_AREA_LABEL = { albay: 'Albay', bicol: 'Bicol' } as const
