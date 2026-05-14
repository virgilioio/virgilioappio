import { Skeleton } from '@/components/ui/skeleton'
import { HeroCardSkeleton, StageStripSkeleton } from '@/components/ui/hero-skeletons'

/**
 * Full candidate profile loading skeleton.
 * Used inside both CandidateProfileSheet and IndependentCandidateProfileSheet.
 *
 * The hero card and stage strip mirror the real `ProfileHeroCard` and
 * `ProfileStageStrip` chrome so the layout doesn't shift when data lands.
 */
export function CandidateProfileSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <HeroCardSkeleton variant="candidate" />
      <StageStripSkeleton />

      {/* Two-column body skeleton (tab content placeholder) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — main content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-virgilio-border bg-white p-5 space-y-4 shadow-sm">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-2.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-5/6" />
              <Skeleton className="h-3.5 w-4/6" />
            </div>
          </div>
          <div className="rounded-2xl border border-virgilio-border bg-white p-5 space-y-4 shadow-sm">
            <Skeleton className="h-5 w-40" />
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column — side panels */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-virgilio-border bg-white p-5 space-y-3 shadow-sm">
            <Skeleton className="h-5 w-24" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-virgilio-border bg-white p-5 space-y-3 shadow-sm">
            <Skeleton className="h-5 w-16" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
