import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { AnimatedEmpty, EmptyCard } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTemplateCounts } from '@/lib/sign/api'

/**
 * Sign › Templates (admins only). Build step 2: the page frame and its counts.
 * The template list and the template wizard arrive in step 10.
 */
export default function SignTemplates() {
  const q = useTemplateCounts()
  const timedOut = useLoadTimeout(q.isLoading, q.dataUpdatedAt)

  return (
    <ListPage
      title="Templates"
      count={q.data?.total}
      meta={
        q.data && (
          <>
            <MetaDot color="#0d0d09">{q.data.sales} for Gio Sales</MetaDot>
            <MetaDot color="#6F3FF5">{q.data.ats} for Gio ATS</MetaDot>
          </>
        )
      }
    >
      {q.isError || timedOut ? (
        <EmptyCard>
          <LoadError what="templates" timedOut={timedOut && !q.isError} onRetry={() => q.refetch()} />
        </EmptyCard>
      ) : (
        <Loadable loading={q.isLoading} skeleton={<EmptyCard><Skeleton className="h-6 w-48" /></EmptyCard>}>
          <EmptyCard>
            <AnimatedEmpty
              scene="jobs"
              onceKey="sign-templates-empty"
              title="No templates yet"
              body="A template holds the documents, who signs them and where. TAs pick ATS templates on a candidate; Sales reps pick Gio Sales templates on a deal."
            />
          </EmptyCard>
        </Loadable>
      )}
    </ListPage>
  )
}
