/** A calendar day as YYYY-MM-DD, in local time (never through UTC). */
export const toIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** YYYY-MM-DD as a local date, or undefined for an empty or broken value. */
export const fromIsoDay = (iso: string | null | undefined): Date | undefined => {
  if (!iso) return undefined
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}
