/**
 * Selling units and how much of each a customer can buy at a time.
 *
 * Weight and volume sold by the kilo or liter can be bought in quarters
 * (0.25 kg); everything counted (pieces, bundles, trays, grams…) is bought
 * in whole numbers. The same rule runs in the browser and on the server, so
 * an order for 2.5 bundles is refused even if it skips the page.
 */

export const UNITS = [
  'piece', 'kg', 'gram', 'bundle', 'pack', 'bag', 'tray', 'dozen', 'liter', 'sack', 'bottle',
] as const

/** The smallest amount a customer can add, and the step of the − / + buttons. */
export function unitStep(unit: string): number {
  const u = unit.trim().toLowerCase()
  // Listings made before the unit list was fixed may say "kilo" or "litre".
  return /^(kg|kgs|kilo|kilos|kilogram|kilograms|l|liter|liters|litre|litres)$/.test(u) ? 0.25 : 1
}

/** Whether `quantity` is a whole number of steps for this unit. */
export function isValidQuantity(quantity: number, unit: string): boolean {
  if (!Number.isFinite(quantity) || quantity <= 0) return false
  const steps = quantity / unitStep(unit)
  return Math.abs(steps - Math.round(steps)) < 1e-9
}

/** The most a customer can buy: the stock rounded down to a whole step. */
export function maxBuyable(stock: number, unit: string): number {
  const step = unitStep(unit)
  return Math.round(Math.floor(stock / step + 1e-9) * step * 100) / 100
}

/**
 * Snaps a typed amount to the nearest step, kept between one step and
 * what's in stock. Returns null when nothing can be bought.
 */
export function snapQuantity(value: number, stock: number, unit: string): number | null {
  const step = unitStep(unit)
  const max = maxBuyable(stock, unit)
  if (max < step) return null
  if (!Number.isFinite(value)) return step
  const snapped = Math.round(value / step) * step
  return Math.round(Math.min(Math.max(snapped, step), max) * 100) / 100
}

/** Why a stock amount doesn't suit the unit, or null if it does. */
export function stockError(stock: number, unit: string): string | null {
  if (unitStep(unit) === 1 && !Number.isInteger(stock))
    return `Stock for a listing sold by the ${unit} must be a whole number`
  return null
}

/** Keeps only what a number box should hold: digits and, if allowed, one decimal point. */
export function numericText(value: string, decimals: boolean): string {
  // Whole numbers: a pasted "3.5" keeps the 3 rather than becoming 35.
  if (!decimals) return value.split('.')[0].replace(/\D/g, '')
  const cleaned = value.replace(/[^0-9.]/g, '')
  const dot = cleaned.indexOf('.')
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '')
}

/** Quantities without trailing zeros: 1.5, 2, 0.25. */
export function fmtQty(n: number): string {
  return parseFloat(n.toFixed(2)).toString()
}
