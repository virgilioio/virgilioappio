/** Paging for the Intelligence RPCs (market_talent_rows, market_past_companies, market_job_links). */
export const PAGE = 1000

/** Pages fetched at once after the first (the RPCs are ordered, so pages never overlap). */
const WAVE = 6

/**
 * Every row of a paged RPC: the first page, then the rest six at a time (2026-11-06; one
 * after another, past companies alone took 16 seconds). Stops at the first short page.
 */
export async function pages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const get = async (page: number) => {
    const { data, error } = await fetchPage(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw error
    return data ?? []
  }
  const all = await get(0)
  if (all.length < PAGE) return all
  for (let next = 1; ; next += WAVE) {
    const wave = await Promise.all(Array.from({ length: WAVE }, (_, i) => get(next + i)))
    for (const batch of wave) {
      all.push(...batch)
      if (batch.length < PAGE) return all
    }
  }
}
