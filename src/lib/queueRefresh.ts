/**
 * The dashboard's "Your queue" reads (2026-11-16). Work finished anywhere else in
 * the app (a scorecard submitted on a profile, a rejection, a stage move, a review,
 * an email sent) must not leave its row behind, so these reads are fresh every time
 * the dashboard opens, are never saved in the browser (persister), and the write
 * paths call refreshQueue() so a dashboard that is still mounted refreshes too.
 */
import type { QueryClient } from '@tanstack/react-query'

export const QUEUE_QUERY_KEYS = ['pending-activities', 'new-applications-queue', 'queue-done-today'] as const

/** Query options shared by the queue's reads: always fresh when the dashboard opens or the tab comes back. */
export const QUEUE_QUERY_OPTIONS = {
  staleTime: 0,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
} as const

function globalClient(): QueryClient | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { __queryClient?: QueryClient }).__queryClient
}

/** Mark the queue's reads out of date (and refetch the ones on screen). */
export function refreshQueue(queryClient?: QueryClient | null): void {
  const client = queryClient ?? globalClient()
  if (!client) return
  for (const key of QUEUE_QUERY_KEYS) void client.invalidateQueries({ queryKey: [key] })
}
