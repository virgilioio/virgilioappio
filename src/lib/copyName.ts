/**
 * The name of a duplicate (2026-11-18): "Copy of Offer letter", then
 * "Copy of Offer letter (2)" when that one is taken, compared without case or
 * outer spaces. A copy of a copy doesn't stack ("Copy of Copy of …"): it takes
 * the next free number of the original. Kept within `max` characters by
 * cutting the original's name, never the number.
 */
export function copyName(name: string, existing: string[], max = 120): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  const base = name.trim().replace(/^copy of\s+/i, '').replace(/\s+\(\d+\)$/, '').trim() || 'Untitled'
  const build = (n: number) => {
    const tail = n > 1 ? ` (${n})` : ''
    const room = Math.max(1, max - 'Copy of '.length - tail.length)
    return `Copy of ${base.slice(0, room).trimEnd()}${tail}`
  }
  for (let n = 1; n < 1000; n++) {
    const candidate = build(n)
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return build(1000)
}
