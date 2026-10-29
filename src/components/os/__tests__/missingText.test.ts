import { describe, expect, it } from 'vitest'
import { missingText } from '../profileChecks'

describe('missingText', () => {
  it('names up to three, then counts the rest', () => {
    expect(missingText(['tax ID'])).toBe('tax ID')
    expect(missingText(['tax ID', 'bank details'])).toBe('tax ID and bank details')
    expect(missingText(['Google Workspace', 'tax ID', 'bank details'])).toBe('Google Workspace, tax ID and bank details')
    expect(missingText(['Google Workspace', 'tax ID', 'bank details', 'shipping address'])).toBe('Google Workspace, tax ID and 2 more')
    expect(missingText([])).toBe('')
  })
})
