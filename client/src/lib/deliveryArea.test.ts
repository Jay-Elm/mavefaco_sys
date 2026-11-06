import { describe, expect, it } from 'vitest'
import { DELIVERY_AREA_TEXT, DELIVERY_TOWN_NAMES, deliveryTownAt } from './deliveryArea'

describe('deliveryTownAt', () => {
  it('names the town for points well inside each one', () => {
    expect(deliveryTownAt(13.3594, 123.7311)).toBe('Tabaco City') // Tabaco poblacion
    expect(deliveryTownAt(13.4007, 123.7008)).toBe('Malinao') // Malinao poblacion
    expect(deliveryTownAt(13.3195, 123.7395)).toBe('Malilipot') // Malilipot poblacion
    expect(deliveryTownAt(13.2219, 123.5241)).toBe('Ligao City') // Ligao poblacion
    expect(deliveryTownAt(13.2580, 123.4980)).toBe('Oas') // Oas poblacion
  })

  it('returns null outside the area', () => {
    expect(deliveryTownAt(13.1391, 123.7438)).toBeNull() // Legazpi City
    expect(deliveryTownAt(13.4441, 123.6403)).toBeNull() // Tiwi
    expect(deliveryTownAt(14.5995, 120.9842)).toBeNull() // Manila
    expect(deliveryTownAt(Number.NaN, 123.7)).toBeNull()
  })

  it('lists the towns in a sentence', () => {
    expect(DELIVERY_TOWN_NAMES).toEqual(['Tabaco City', 'Malinao', 'Malilipot', 'Ligao City', 'Oas'])
    expect(DELIVERY_AREA_TEXT).toBe('Tabaco City, Malinao, Malilipot, Ligao City and Oas')
  })
})
