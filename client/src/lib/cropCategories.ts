/** Crop categories in the order lists show them. */
export const CROP_CATEGORIES = [
  'Fruit vegetables',
  'Leafy vegetables',
  'Legumes',
  'Root crops',
  'Herbs and spices',
  'Other vegetables',
  'Fruits',
  'Grains',
  'Plantation crops',
] as const

const rank = (c?: string) => {
  const i = CROP_CATEGORIES.indexOf((c ?? '') as (typeof CROP_CATEGORIES)[number])
  return i === -1 ? CROP_CATEGORIES.length : i
}

/** Crops by category, then by name. */
export function byCategory<C extends { name: string; category?: string }>(crops: C[]): C[] {
  return [...crops].sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name))
}
