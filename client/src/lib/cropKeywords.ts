/**
 * Matching listing names to crops. Each crop carries its other names in
 * English, Filipino or Bikol (CropType.aliases, editable on Crop Types).
 */
export interface NamedCrop {
  id: number
  name: string
  aliases?: string[]
}

// Short words that must stand alone ("upo" is also in "kapuso").
const WHOLE_WORD_MAX = 4

function hit(name: string, word: string): boolean {
  const w = word.toLowerCase().trim()
  if (!w) return false
  if (w.length <= WHOLE_WORD_MAX) return new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(name)
  return name.includes(w)
}

/** The words that name a crop: its name and its other names. */
export const cropWords = (c: NamedCrop) => [c.name, ...(c.aliases ?? [])].map((w) => w.toLowerCase())

/**
 * The crop a listing name points to. The most specific match wins
 * ("Pechay Baguio" is Pechay Baguio, not Pechay); a tie means unsure, so null.
 */
export function suggestCropType<C extends NamedCrop>(listingName: string, crops: C[]): C | null {
  const name = listingName.toLowerCase()
  if (!name.trim()) return null
  let best: C[] = []
  let bestLen = 0
  for (const c of crops) {
    const len = Math.max(0, ...cropWords(c).filter((w) => hit(name, w)).map((w) => w.length))
    if (len === 0) continue
    if (len > bestLen) { best = [c]; bestLen = len }
    else if (len === bestLen) best.push(c)
  }
  return best.length === 1 ? best[0] : null
}

/** Crops whose name or other names contain the search text, best matches first. */
export function searchCrops<C extends NamedCrop>(query: string, crops: C[]): { crop: C; via: string | null }[] {
  const q = query.toLowerCase().trim()
  if (!q) return crops.map((crop) => ({ crop, via: null }))
  const out: { crop: C; via: string | null; rank: number }[] = []
  for (const crop of crops) {
    const name = crop.name.toLowerCase()
    if (name.startsWith(q)) { out.push({ crop, via: null, rank: 0 }); continue }
    if (name.includes(q)) { out.push({ crop, via: null, rank: 1 }); continue }
    const alias = (crop.aliases ?? []).find((a) => a.toLowerCase().includes(q))
    if (alias) out.push({ crop, via: alias, rank: alias.toLowerCase().startsWith(q) ? 2 : 3 })
  }
  return out.sort((a, b) => a.rank - b.rank || a.crop.name.localeCompare(b.crop.name)).map(({ crop, via }) => ({ crop, via }))
}
