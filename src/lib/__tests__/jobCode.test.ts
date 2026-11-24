import { describe, expect, it } from 'vitest'
import { jobCodeCore, jobCodeMatches, looksLikeJobCode, withJobCode } from '../jobCode'

describe('Job ID search', () => {
  it('reads an ID however it is typed', () => {
    for (const q of ['VG-7K3P', 'vg-7k3p', 'vg7k3p', 'VG 7K3P', ' 7k3p ', 'VG-7K', 'vg']) {
      expect(looksLikeJobCode(q)).toBe(true)
    }
    expect(jobCodeCore('vg-7k3p')).toBe('7K3P')
    expect(jobCodeCore('VG 7K3P')).toBe('7K3P')
  })

  it('leaves ordinary words to the title search', () => {
    for (const q of ['Designer', 'sales', 'ops', 'MAKE', 'vgx-1234', 'VG-12345', '']) {
      expect(looksLikeJobCode(q)).toBe(false)
    }
  })

  it('matches the job whose ID starts with what was typed', () => {
    expect(jobCodeMatches('VG-7K3P', 'vg7k')).toBe(true)
    expect(jobCodeMatches('VG-7K3P', '7K3P')).toBe(true)
    expect(jobCodeMatches('VG-7K3P', 'VG-8K3P')).toBe(false)
    expect(jobCodeMatches(null, 'VG-7K3P')).toBe(false)
  })

  it('lets a client-side search find a job by its ID', () => {
    const hay = (code: string) => withJobCode('Senior Designer Acme', code).toLowerCase()
    expect(hay('VG-7K3P').includes('vg-7k3p')).toBe(true)
    expect(hay('VG-7K3P').includes('7k3p')).toBe(true)
    expect(hay('VG-7K3P').includes('designer')).toBe(true)
    expect(withJobCode('Senior Designer', null)).toBe('Senior Designer')
  })
})
