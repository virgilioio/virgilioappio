/**
 * Cache tier presets for react-query.
 *
 * Spread one of these into a useQuery options object to opt into a documented
 * caching policy:
 *   useQuery({ ...cacheTiers.reference, queryKey, queryFn })
 *
 * See src/lib/cache/README.md for the full contract.
 */

const MIN = 60 * 1000
const HOUR = 60 * MIN

export const cacheTiers = {
  /** Always-fresh: mutations' read-after-write, active kanban boards. */
  realtime: {
    staleTime: 0,
    gcTime: 5 * MIN,
  },
  /** Default for transactional lists (candidates, jobs, scorecards in flight). */
  transactional: {
    staleTime: 60 * 1000,
    gcTime: 10 * MIN,
  },
  /** Slow-changing operational data (dashboard widgets, analytics, members). */
  reference: {
    staleTime: 10 * MIN,
    gcTime: 60 * MIN,
  },
  /** Effectively static lookup data (filter options, app fields, integration registry). */
  static: {
    staleTime: 60 * MIN,
    gcTime: 24 * HOUR,
  },
} as const

export type CacheTier = keyof typeof cacheTiers
