import type { Format } from './types'

export function fmt(
  value: number | null | undefined,
  format: Format,
  currency?: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  switch (format) {
    case 'count':
      return Math.round(value).toLocaleString('en-US')
    case 'days':
      return `${(Math.round(value * 10) / 10)}d`
    case 'pct':
      return `${Math.round(value)}%`
    case 'money':
      return formatMoney(value, currency)
  }
}

export function formatMoney(value: number, currency = 'USD'): string {
  const abs = Math.abs(value)
  const compact = abs >= 1000
  try {
    const compactPart = new Intl.NumberFormat('en-US', {
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 0,
    }).format(value)
    // Get currency symbol for the code
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).formatToParts(1)
    const symbol = parts.find(p => p.type === 'currency')?.value ?? ''
    return `${symbol}${compactPart} ${currency}`
  } catch {
    return `${Math.round(value).toLocaleString('en-US')} ${currency}`
  }
}
