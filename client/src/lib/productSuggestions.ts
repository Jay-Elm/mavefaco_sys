interface Category { id: number; name: string }

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  vegetables: [
    'pechay', 'kangkong', 'sitaw', 'string beans', 'ampalaya', 'bitter gourd', 'okra',
    'talong', 'eggplant', 'kamatis', 'tomato', 'sibuyas', 'onion', 'bawang', 'garlic',
    'luya', 'ginger', 'repolyo', 'cabbage', 'labanos', 'radish', 'patola', 'sayote',
    'chayote', 'kalabasa', 'squash', 'mais', 'corn', 'mustasa', 'mustard', 'spinach',
    'malunggay', 'moringa', 'saluyot', 'pepper', 'sili', 'chili', 'upo', 'bottle gourd',
    'papaya', 'dahon', 'leaf', 'gulay', 'vegetable', 'legume', 'bean', 'pea', 'lentil',
    'broccoli', 'cauliflower', 'carrot', 'karot', 'sibuyas tagalog', 'leek', 'celery',
    'kinchay', 'parsley', 'sweet potato tops', 'camote tops', 'tanglad', 'lemongrass',
    'puso ng saging', 'banana blossom', 'labong', 'bamboo shoot',
  ],
  fruits: [
    'mangga', 'mango', 'saging', 'banana', 'pinya', 'pineapple', 'suha', 'pomelo',
    'dalanghita', 'mandarin', 'dalandan', 'orange', 'kalamansi', 'calamansi', 'lemon',
    'rambutan', 'lanzones', 'langka', 'jackfruit', 'durian', 'atis', 'custard apple',
    'guyabano', 'soursop', 'guava', 'bayabas', 'papaya', 'watermelon', 'pakwan',
    'melon', 'santol', 'buko', 'coconut', 'niyog', 'strawberry', 'grape', 'ubas',
    'avocado', 'abokado', 'pear', 'peras', 'apple', 'mansanas', 'dragon fruit',
    'pitaya', 'marang', 'balimbing', 'starfruit', 'caimito', 'camachile',
  ],
  'root crops': [
    'kamote', 'sweet potato', 'gabi', 'taro', 'ube', 'purple yam', 'cassava', 'kamoteng kahoy',
    'singkamas', 'jicama', 'turnip', 'potato', 'patatas', 'yam', 'tugui', 'arrowroot',
    'araro', 'radish', 'beet', 'beetroot', 'carrot', 'karot', 'parsnip',
  ],
  grains: [
    'palay', 'rice', 'bigas', 'mais', 'corn', 'maize', 'wheat', 'trigo', 'oats',
    'millet', 'sorghum', 'quinoa', 'barley', 'buckwheat', 'rye', 'sago',
  ],
  legumes: [
    'mongo', 'munggo', 'mung bean', 'balatong', 'patani', 'lima bean', 'sitaw', 'string bean',
    'bataw', 'hyacinth bean', 'kadyos', 'pigeon pea', 'garbanzos', 'chickpea',
    'soybean', 'toyo', 'kidney bean', 'black bean', 'red bean', 'lentil',
  ],
  poultry: [
    'manok', 'chicken', 'itlog', 'egg', 'pato', 'duck', 'quail', 'pugo', 'turkey',
    'goose', 'guinea fowl', 'native chicken', 'free range', 'organic egg',
  ],
  livestock: [
    'baboy', 'pig', 'pork', 'baka', 'beef', 'cattle', 'cow', 'carabao', 'kalabaw',
    'kambing', 'goat', 'tupa', 'sheep', 'rabbit', 'kuneho', 'horse', 'kabayo',
  ],
  fish: [
    'bangus', 'milkfish', 'tilapia', 'galunggong', 'mackerel', 'tuna', 'tulingan',
    'tambakol', 'salmon', 'sardine', 'herring', 'lapu-lapu', 'grouper', 'maya-maya',
    'snapper', 'pompano', 'dalag', 'mudfish', 'hito', 'catfish', 'carp', 'carpa',
    'dilis', 'anchovies', 'squid', 'pusit', 'shrimp', 'hipon', 'prawn', 'alimango',
    'crab', 'alimasag', 'tahong', 'mussel', 'talaba', 'oyster', 'halaan', 'clam',
    'suso', 'snail', 'seafood', 'isda', 'fish',
  ],
  herbs: [
    'herba', 'herb', 'basil', 'balanoy', 'oregano', 'thyme', 'rosemary', 'mint',
    'yerba buena', 'peppermint', 'coriander', 'wansuy', 'cilantro', 'parsley',
    'kinchay', 'sage', 'bay leaf', 'laurel', 'tanglad', 'lemongrass', 'pandan',
    'turmeric', 'luyang dilaw', 'ginger', 'luya', 'sambong', 'lagundi', 'tsaang gubat',
  ],
  spices: [
    'paminta', 'pepper', 'luya', 'ginger', 'bawang', 'garlic', 'sibuyas', 'onion',
    'sili', 'chili', 'paprika', 'cumin', 'coriander', 'cinnamon', 'kanela',
    'cloves', 'sinamak', 'anise', 'hanis', 'turmeric', 'curry', 'bay leaf', 'laurel',
    'vanilla', 'mustard', 'star anise', 'cardamom', 'nutmeg',
  ],
  dairy: [
    'gatas', 'milk', 'kesong puti', 'cheese', 'yogurt', 'butter', 'mantequilla',
    'cream', 'condensed', 'evaporated', 'goat milk', 'carabao milk',
  ],
  processed: [
    'vinegar', 'suka', 'cooking oil', 'mantika', 'bagoong', 'shrimp paste',
    'patis', 'fish sauce', 'soy sauce', 'toyo', 'coconut oil', 'langis ng niyog',
    'dried fish', 'tuyo', 'tinapa', 'smoked', 'pickled', 'fermented', 'preserved',
    'jam', 'jelly', 'syrup', 'honey', 'pulot', 'muscovado', 'sugar', 'asukal',
    'flour', 'harina', 'starch', 'gawgaw',
  ],
}

export const UNIT_KEYWORDS: Record<string, string[]> = {
  bundle: [
    'pechay', 'kangkong', 'sitaw', 'string bean', 'mustasa', 'mustard', 'malunggay', 'moringa',
    'saluyot', 'camote tops', 'sweet potato tops', 'kinchay', 'parsley', 'coriander', 'wansuy',
    'cilantro', 'tanglad', 'lemongrass', 'pandan', 'oregano', 'basil', 'balanoy', 'mint',
    'yerba buena', 'rosemary', 'thyme', 'sage', 'labong', 'bamboo shoot', 'dahon', 'leaf',
    'herb', 'herba', 'spinach', 'celery', 'leek', 'sibuyas tagalog', 'green onion',
    'puso ng saging', 'banana blossom',
  ],
  kg: [
    'mangga', 'mango', 'saging', 'banana', 'pinya', 'pineapple', 'rambutan', 'lanzones',
    'bayabas', 'guava', 'pakwan', 'watermelon', 'melon', 'strawberry', 'grape', 'ubas',
    'avocado', 'abokado', 'santol', 'balimbing', 'starfruit', 'camachile', 'marang', 'pitaya',
    'dragon fruit', 'kalamansi', 'calamansi', 'lemon', 'dalandan', 'dalanghita', 'mandarin',
    'kamatis', 'tomato', 'sibuyas', 'onion', 'bawang', 'garlic', 'luya', 'ginger',
    'repolyo', 'cabbage', 'labanos', 'radish', 'sayote', 'chayote', 'kalabasa', 'squash',
    'ampalaya', 'bitter gourd', 'talong', 'eggplant', 'okra', 'patola', 'upo', 'bottle gourd',
    'broccoli', 'cauliflower', 'mais', 'corn', 'carrot', 'karot', 'pepper', 'sili', 'chili',
    'kamote', 'sweet potato', 'gabi', 'taro', 'ube', 'cassava', 'kamoteng kahoy', 'singkamas',
    'potato', 'patatas', 'yam', 'tugui', 'beet', 'beetroot', 'parsnip',
    'bangus', 'milkfish', 'tilapia', 'galunggong', 'mackerel', 'tuna', 'tulingan', 'tambakol',
    'salmon', 'sardine', 'herring', 'snapper', 'pompano', 'dalag', 'mudfish', 'hito', 'catfish',
    'carp', 'carpa', 'squid', 'pusit', 'shrimp', 'hipon', 'prawn', 'alimango', 'crab',
    'alimasag', 'tahong', 'mussel', 'talaba', 'oyster', 'halaan', 'clam', 'isda', 'fish',
    'baboy', 'pig', 'pork', 'baka', 'beef', 'kambing', 'goat', 'tupa', 'sheep',
    'mongo', 'munggo', 'mung bean', 'balatong', 'patani', 'lima bean', 'bataw', 'kadyos',
    'garbanzos', 'chickpea', 'soybean', 'kidney bean', 'black bean', 'red bean', 'lentil',
    'muscovado', 'sugar', 'asukal', 'flour', 'harina', 'starch', 'gawgaw',
    'turmeric', 'luyang dilaw', 'dried fish', 'tuyo', 'tinapa', 'bagoong',
  ],
  piece: [
    'buko', 'coconut', 'niyog', 'langka', 'jackfruit', 'suha', 'pomelo', 'durian',
    'atis', 'custard apple', 'guyabano', 'soursop', 'papaya', 'pear', 'peras',
    'apple', 'mansanas', 'caimito', 'manok', 'chicken', 'pato', 'duck', 'turkey',
    'lapu-lapu', 'grouper', 'maya-maya', 'kesong puti', 'cheese',
  ],
  tray: [
    'itlog', 'egg', 'pugo', 'quail egg', 'native egg', 'organic egg', 'duck egg', 'pato egg',
  ],
  dozen: [
    'itlog', 'egg', 'kalamansi', 'calamansi', 'quail egg', 'pugo',
  ],
  sack: [
    'palay', 'rice', 'bigas', 'mais', 'corn', 'maize', 'trigo', 'wheat', 'millet',
    'sorghum', 'barley', 'oats', 'rye', 'sago',
  ],
  liter: [
    'gatas', 'milk', 'coconut milk', 'gata', 'goat milk', 'carabao milk',
    'cooking oil', 'mantika', 'coconut oil', 'langis ng niyog', 'langis',
  ],
  bottle: [
    'vinegar', 'suka', 'sinamak', 'patis', 'fish sauce', 'soy sauce', 'toyo',
    'cooking oil', 'mantika', 'coconut oil', 'langis', 'syrup', 'honey', 'pulot',
    'jam', 'jelly', 'hot sauce', 'oyster sauce',
  ],
  gram: [
    'paminta', 'pepper', 'paprika', 'cumin', 'coriander', 'cinnamon', 'kanela',
    'cloves', 'anise', 'hanis', 'star anise', 'cardamom', 'nutmeg', 'curry',
    'vanilla', 'dried herb', 'dried spice', 'powder', 'pulbos',
  ],
  pack: [
    'dried', 'smoked', 'tinapa', 'tuyo', 'dried fish', 'pickled', 'fermented', 'preserved',
    'processed', 'instant', 'mixed', 'seasoning', 'spice mix',
  ],
}

export function suggestCategory(name: string, categories: Category[]): Category | null {
  if (!name.trim() || categories.length === 0) return null
  const lower = name.toLowerCase()

  for (const cat of categories) {
    if (lower.includes(cat.name.toLowerCase())) return cat
  }

  let bestCat: Category | null = null
  let bestScore = 0

  for (const cat of categories) {
    const catKey = Object.keys(CATEGORY_KEYWORDS).find(k =>
      cat.name.toLowerCase().includes(k) || k.includes(cat.name.toLowerCase())
    )
    if (!catKey) continue
    const score = CATEGORY_KEYWORDS[catKey].filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; bestCat = cat }
  }

  return bestScore > 0 ? bestCat : null
}

export function suggestUnit(name: string): string | null {
  if (!name.trim()) return null
  const lower = name.toLowerCase()

  let bestUnit: string | null = null
  let bestScore = 0

  for (const [unit, keywords] of Object.entries(UNIT_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; bestUnit = unit }
  }

  return bestScore > 0 ? bestUnit : null
}
