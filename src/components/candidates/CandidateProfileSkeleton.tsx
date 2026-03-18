import { Skeleton } from '@/components/ui/skeleton'

/**
 * Full candidate profile loading skeleton.
 * Used inside both CandidateProfileSheet and IndependentCandidateProfileSheet.
 */
export function CandidateProfileSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Name card / tabs skeleton */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>

      {/* Two-column layout skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Details card */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-28" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex justify-between items-center">
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              ))}
            </div>
          </div>

          {/* Skills card */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-16" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>

          {/* Summary card */}
          <div className="space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Activity / comments card */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-24" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>

          {/* Work experience card */}
          <div className="space-y-4">
            <Skeleton className="h-5 w-36" />
            {[1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
