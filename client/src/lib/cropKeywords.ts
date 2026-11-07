/**
 * Words that name each crop in a listing, in English or Filipino. Used to
 * suggest a crop as a farmer types a listing name (the same lists filled in
 * existing listings, migration product_crop_type).
 */
export const CROP_KEYWORDS: Record<string, string[]> = {
  Ampalaya: ['ampalaya', 'amargoso', 'bitter gourd', 'bitter melon'],
  Eggplant: ['eggplant', 'talong'],
  Kangkong: ['kangkong', 'water spinach', 'swamp cabbage'],
  Lettuce: ['lettuce', 'letsugas'],
  Mustasa: ['mustasa', 'mustard'],
  Okra: ['okra'],
  Patola: ['patola', 'sponge gourd', 'luffa'],
  Pechay: ['pechay', 'petsay', 'bok choy', 'pak choi'],
  'Siling Labuyo': ['siling labuyo', 'labuyo', 'chili', 'chilli', 'sili'],
  Sitaw: ['sitaw', 'string bean', 'yardlong', 'balatong'],
  Squash: ['squash', 'kalabasa', 'karabasa'],
  Tomato: ['tomato', 'kamatis'],
  Upo: ['upo', 'bottle gourd'],
}

// Short words that must stand alone ("upo" is also in "kapuso").
const WHOLE_WORD = new Set(['upo', 'sili', 'okra'])

/** The crop a listing name points to, if exactly one does. */
export function suggestCropType<C extends { id: number; name: string }>(listingName: string, crops: C[]): C | null {
  const name = listingName.toLowerCase()
  if (!name.trim()) return null
  const hits = crops.filter((c) => {
    const words = CROP_KEYWORDS[c.name] ?? [c.name.toLowerCase()]
    return words.some((w) => (WHOLE_WORD.has(w) ? new RegExp(`\\b${w}\\b`).test(name) : name.includes(w)))
  })
  return hits.length === 1 ? hits[0] : null
}
