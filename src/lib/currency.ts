import { CURRENCY_SYMBOLS } from '@/constants/currencies'

/**
 * Format a money amount for display.
 * Examples: formatMoney(1234, 'USD') -> "$1,234"
 *           formatMoney(1234.5, 'EUR', { decimals: 2 }) -> "€1,234.50"
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  opts: { decimals?: number; suffixCode?: boolean } = {},
): string {
  if (amount == null || isNaN(Number(amount))) return '—'
  const ccy = (currency ?? '').toUpperCase()
  const symbol = CURRENCY_SYMBOLS[ccy] ?? ''
  const decimals = opts.decimals ?? 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(amount))
  const code = opts.suffixCode && ccy ? ` ${ccy}` : ''
  return `${symbol}${formatted}${code}`
}

/** Compact "≈" representation for converted base amounts in cards. */
export function formatBasePreview(amount: number | null | undefined, baseCurrency: string | null | undefined): string {
  if (amount == null) return ''
  return `≈ ${formatMoney(amount, baseCurrency)}`
}
