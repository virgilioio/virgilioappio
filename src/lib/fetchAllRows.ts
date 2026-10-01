/**
 * The database returns at most 1,000 rows per request. Analytics must see every row,
 * so all analytics reads go through these helpers.
 */
const PAGE = 1000

/** Page through a query until a short page. `build` must return a fresh query each call. */
export async function fetchAll<T = any>(build: () => any): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data || []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

/** Split long id lists (keeps request URLs short) and merge the results. */
export async function inChunks<T = any>(ids: string[], fn: (chunk: string[]) => Promise<T[]>, size = 150): Promise<T[]> {
  if (!ids.length) return []
  const parts: string[][] = []
  for (let i = 0; i < ids.length; i += size) parts.push(ids.slice(i, i + size))
  const res = await Promise.all(parts.map(fn))
  return res.flat()
}

/** Common case: every row of `table` whose `column` is in `ids`, fully paginated. */
export function fetchAllIn<T = any>(ids: string[], column: string, build: (chunk: string[]) => any): Promise<T[]> {
  return inChunks<T>(ids, chunk => fetchAll<T>(() => build(chunk)))
}
