/**
 * Runs `fn` over `items` with at most `limit` calls in flight, keeping the
 * results in the same order as the items. Used to load long lists in a few
 * parallel requests instead of one request after another.
 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return out
}

/** Splits a list into chunks of `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** A short, stable key for a list of ids (for query keys). */
export function idsKey(ids: string[]): string {
  let h = 5381
  for (const id of ids) for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0
  return `${ids.length}:${(h >>> 0).toString(36)}`
}
