import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useEnvelopeCounts } from '@/lib/sign/api'

/**
 * Sign › Envelopes (admins only). Build step 2: the page frame and its counts.
 * The table, filters and details sheet arrive in step 3.
 */
export default function SignEnvelopes() {
  const q = useEnvelopeCounts()
  const timedOut = useLoadTimeout(q.isLoading, q.dataUpdatedAt)
  const c = q.data?.counts ?? {}

  return (
    <ListPage
      title="Envelopes"
      count={q.data?.total}
      meta={
        q.data && (
          <>
            <MetaDot color="#E0891A">{c.sent ?? 0} out for signature</MetaDot>
            <MetaDot color="#8B5CF6">{c.scheduled ?? 0} scheduled</MetaDot>
            <MetaDot color="#12B886">{c.completed ?? 0} completed</MetaDot>
            <MetaDot color="#8B8F9E">
              {c.draft ?? 0} draft{(c.draft ?? 0) === 1 ? '' : 's'}
            </MetaDot>
          </>
        )
      }
    >
      {q.isError || timedOut ? (
        <EmptyCard>
          <LoadError what="envelopes" timedOut={timedOut && !q.isError} onRetry={() => q.refetch()} />
        </EmptyCard>
      ) : (
        <Loadable loading={q.isLoading} skeleton={<EmptyCard><Skeleton className="h-6 w-48" /></EmptyCard>}>
          <EmptyCard>
            <AnimatedEmpty
              scene="jobs"
              onceKey="sign-envelopes-empty"
              title="No envelopes yet"
              body="Offers sent from a candidate, agreements sent from a deal in Gio Sales, and member agreements sent from here will show up in this list with their status."
            />
          </EmptyCard>
        </Loadable>
      )}
    </ListPage>
  )
}
