import { describe, expect, it } from 'vitest'
import { formatOfferValue } from '../offerValues'

// The same cases as supabase/tests/18_sign_offer_fields.sql (sign_offer_display).
describe('formatOfferValue', () => {
  it('formats the types agreements used to print raw', () => {
    expect(formatOfferValue('1250', 'number')).toBe('1,250')
    expect(formatOfferValue('about ten', 'number')).toBe('about ten')
    expect(formatOfferValue('https://www.acme.com/careers/', 'url')).toBe('acme.com/careers')
    expect(formatOfferValue('https://linkedin.com/in/priya', 'linkedin')).toBe('linkedin.com/in/priya')
    expect(formatOfferValue('+52   33 1991  0667', 'phone')).toBe('+52 33 1991 0667')
    expect(formatOfferValue('4', 'score', { config: {} })).toBe('4 out of 5')
    expect(formatOfferValue('7', 'score', { config: { max: 10 } })).toBe('7 out of 10')
    expect(formatOfferValue('tenant/offers/1760000000000-Signed contract.pdf', 'file')).toBe('Signed contract.pdf')
  })

  it('keeps the existing rules', () => {
    expect(formatOfferValue('true', 'checkbox')).toBe('Yes')
    expect(formatOfferValue('{"amount":"132500","currency":"MXN"}', 'salary')).toBe('MXN 132,500')
    expect(formatOfferValue('', 'number')).toBeNull()
  })
})
