import type { Format } from './types'

export function fmt(value: number | null | undefined, format: Format): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  switch (format) {
    case 'count':
      return Math.round(value).toLocaleString('en-US')
    case 'days':
      return `${Math.round(value)}d`
    case 'pct':
      return `${Math.round(value)}%`
  }
}
