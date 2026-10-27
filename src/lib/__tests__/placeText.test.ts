import { describe, expect, it } from 'vitest'
import { placeFromText, placeToText } from '@/lib/places'

describe('place lines', () => {
  it('writes city, state, country', () => {
    expect(placeToText({ city: 'Monterrey', region: 'Nuevo León', country: 'Mexico' })).toBe('Monterrey, Nuevo León, Mexico')
    expect(placeToText({ city: '', region: '', country: 'Mexico' })).toBe('Mexico')
    expect(placeToText({ city: '', region: '', country: '' })).toBe('')
  })

  it('reads its own lines back', () => {
    for (const p of [
      { city: 'Monterrey', region: 'Nuevo León', country: 'Mexico' },
      { city: 'Bogotá', region: '', country: 'Colombia' },
      { city: '', region: '', country: 'Mexico' },
    ]) expect(placeFromText(placeToText(p))).toEqual(p)
  })

  it('accepts a country code or name at the end', () => {
    expect(placeFromText('Austin, Texas, US')).toEqual({ city: 'Austin', region: 'Texas', country: 'United States' })
  })

  it('keeps anything that does not end in a country as the city', () => {
    expect(placeFromText('Remote')).toEqual({ city: 'Remote', region: '', country: '' })
    expect(placeFromText('Zapopan, Jalisco')).toEqual({ city: 'Zapopan, Jalisco', region: '', country: '' })
    expect(placeFromText('')).toEqual({ city: '', region: '', country: '' })
  })
})
