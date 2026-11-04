import { describe, expect, it } from 'vitest'
import { maskEmail } from './maskEmail'

describe('maskEmail', () => {
  it('keeps the first and last two letters of the name and the whole domain', () => {
    expect(maskEmail('jayelmeneses@gmail.com')).toBe('ja••••••••es@gmail.com')
    expect(maskEmail('maria.cruz@yahoo.com')).toBe('ma••••••uz@yahoo.com')
  })

  it('hides short names almost entirely', () => {
    expect(maskEmail('juan@gmail.com')).toBe('j•••@gmail.com')
    expect(maskEmail('jo@gmail.com')).toBe('j•@gmail.com')
    expect(maskEmail('j@gmail.com')).toBe('j•@gmail.com')
  })

  it('never shows something that is not an address', () => {
    expect(maskEmail('nonsense')).toBe('••••••••')
    expect(maskEmail('')).toBe('•••')
  })
})
