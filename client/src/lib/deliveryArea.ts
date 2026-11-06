import towns from './deliveryArea.json'

/**
 * Where farmers deliver: Tabaco City and the four towns that share a land
 * border with it (Malinao, Malilipot, Ligao City and Oas). Towns that only
 * meet Tabaco at Mayon's summit are left out.
 *
 * Outlines: NAMRIA and PSA municipal boundaries (via OCHA COD-AB, CC BY-IGO,
 * PSGC 3Q 2026), simplified to 1% of their points, so a pin within a few
 * hundred metres of a town line can land on the wrong side of it.
 */
type Ring = number[][] // [lng, lat] pairs
type Town = { name: string; psgc: number; polygons: Ring[][] }

export const DELIVERY_TOWNS: readonly Town[] = towns as Town[]

export const DELIVERY_TOWN_NAMES = DELIVERY_TOWNS.map((t) => t.name)

/** "Tabaco City, Malinao, Malilipot, Ligao City and Oas" */
export const DELIVERY_AREA_TEXT = `${DELIVERY_TOWN_NAMES.slice(0, -1).join(', ')} and ${DELIVERY_TOWN_NAMES.at(-1)}`

export const BOUNDARY_CREDIT = 'Town boundaries: NAMRIA and PSA (CC BY-IGO)'

function inRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** The delivery-area town a point is in, or null when it's outside the area. */
export function deliveryTownAt(lat: number, lng: number): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  for (const town of DELIVERY_TOWNS) {
    for (const [outer, ...holes] of town.polygons) {
      if (inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) return town.name
    }
  }
  return null
}
