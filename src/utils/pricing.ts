export function formatPrice(cents: number, currency = 'usd'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function calculateYearlySavings(
  monthlyPriceCents: number,
  yearlyPriceCents: number
): number {
  const yearlyMonthly = monthlyPriceCents * 12;
  return Math.round(((yearlyMonthly - yearlyPriceCents) / yearlyMonthly) * 100);
}

export function formatInterval(interval: 'month' | 'year'): string {
  return interval === 'month' ? '/month' : '/year';
}
