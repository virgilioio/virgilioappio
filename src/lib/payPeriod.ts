/** The pay period a new salary range starts with: monthly for MXN, else yearly (2026-11-24).
 *  The job form picks it with the first figure typed; it stays changeable. */
export function defaultPayPeriod(currency: string | null | undefined): 'monthly' | 'annual' {
  return String(currency || 'USD').toUpperCase() === 'MXN' ? 'monthly' : 'annual'
}
