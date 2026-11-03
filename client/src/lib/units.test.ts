import { describe, expect, it } from 'vitest'
import { isValidQuantity, maxBuyable, numericText, snapQuantity, stockError, unitStep } from './units'

describe('unitStep', () => {
  it('lets kilos and liters go in quarters', () => {
    expect(unitStep('kg')).toBe(0.25)
    expect(unitStep('liter')).toBe(0.25)
    expect(unitStep(' Kilo ')).toBe(0.25)
    expect(unitStep('litre')).toBe(0.25)
  })

  it('keeps counted units whole, grams included', () => {
    for (const u of ['piece', 'bundle', 'pack', 'bag', 'tray', 'dozen', 'sack', 'bottle', 'gram'])
      expect(unitStep(u)).toBe(1)
  })

  it("doesn't mistake a unit that merely contains the letters", () => {
    expect(unitStep('package')).toBe(1)
  })
})

describe('isValidQuantity', () => {
  it('accepts whole steps only', () => {
    expect(isValidQuantity(1.75, 'kg')).toBe(true)
    expect(isValidQuantity(1.3, 'kg')).toBe(false)
    expect(isValidQuantity(3, 'piece')).toBe(true)
    expect(isValidQuantity(2.5, 'bundle')).toBe(false)
    expect(isValidQuantity(0, 'kg')).toBe(false)
    expect(isValidQuantity(-1, 'piece')).toBe(false)
  })
})

describe('maxBuyable and snapQuantity', () => {
  it('rounds the stock down to a whole step', () => {
    expect(maxBuyable(10.3, 'kg')).toBe(10.25)
    expect(maxBuyable(5.5, 'piece')).toBe(5)
  })

  it('snaps typed amounts into range', () => {
    expect(snapQuantity(1.3, 10, 'kg')).toBe(1.25)
    expect(snapQuantity(0.1, 10, 'kg')).toBe(0.25)
    expect(snapQuantity(99, 4, 'piece')).toBe(4)
    expect(snapQuantity(2.6, 4, 'piece')).toBe(3)
  })

  it('returns null when not even one step is in stock', () => {
    expect(snapQuantity(1, 0.2, 'kg')).toBeNull()
    expect(snapQuantity(1, 0.5, 'piece')).toBeNull()
  })
})

describe('stockError', () => {
  it('wants whole stock for counted units', () => {
    expect(stockError(2.5, 'piece')).toMatch(/whole number/)
    expect(stockError(3, 'piece')).toBeNull()
    expect(stockError(2.5, 'kg')).toBeNull()
  })
})

describe('numericText', () => {
  it('keeps digits and one decimal point', () => {
    expect(numericText('12.5.0', true)).toBe('12.50')
    expect(numericText('₱1,200', true)).toBe('1200')
    expect(numericText('3.5', false)).toBe('3')
  })
})
