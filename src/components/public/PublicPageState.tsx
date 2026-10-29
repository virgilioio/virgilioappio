import { Skeleton } from '@/components/ui/skeleton'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'

/**
 * The whole-page states of the client pages (the shared pipeline and the
 * dossier), Motion & Feel §16–§17: a skeleton the shape of the page while it
 * loads, LoadError with Retry when it fails or takes over 15s, and the search
 * scene for a link that doesn't open anything. Never raw server text.
 */

const PAGE = 'bg-virgilio-cream font-inter'

/** The page while it loads: the top bar, a title and a card of lines. */
export function PublicPageSkeleton({ board = false }: { board?: boolean }) {
  return (
    <div className={PAGE} style={{ minHeight: '100dvh' }} aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between border-b border-[#ECE7DD] px-4 py-4 sm:px-9">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="hidden h-4 w-40 sm:block" />
      </div>
      <div className="mx-auto w-full max-w-[1080px] px-4 pt-6 sm:px-9">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-7 w-72 max-w-full" />
        {board ? (
          <>
            <Skeleton className="mt-5 h-12 w-full rounded-xl" />
            <div className="mt-3.5 flex gap-3 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="min-w-[250px] flex-1 rounded-xl border border-[#E7E8EE] bg-[#FAFAF7] p-2">
                  <Skeleton className="h-6 w-28" />
                  <Skeleton className="mt-3 h-[74px] w-full rounded-[10px]" />
                  <Skeleton className="mt-2 h-[74px] w-full rounded-[10px]" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border border-[#E7E8EE] bg-white p-6">
            <Skeleton className="h-8 w-56 max-w-full" />
            <Skeleton className="mt-3 h-4 w-80 max-w-full" />
            <div className="mt-6 grid gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="mt-6 h-40 w-full rounded-xl" />
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${PAGE} grid place-items-center px-4`} style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-[440px] py-16">{children}</div>
    </div>
  )
}

/** A first load that failed or took over 15s. */
export function PublicLoadFailed({ what, timedOut, onRetry }: { what: string; timedOut: boolean; onRetry: () => void }) {
  return (
    <Centered>
      <LoadError what={what} timedOut={timedOut} onRetry={onRetry} />
    </Centered>
  )
}

/** A link that doesn't open anything: never issued, mistyped or taken back. */
export function PublicMissing({ onceKey }: { onceKey: string }) {
  return (
    <Centered>
      <AnimatedEmpty
        scene="search"
        onceKey={onceKey}
        title="This link doesn't open anything"
        body="It may be mistyped, or it's no longer shared. Ask the person who sent it for a new link."
      />
    </Centered>
  )
}
