import { Skeleton } from '@/components/ui/skeleton'

/** A careers page's footprint while it loads (§6): top bar, hero, filters and the role list. */
export function CareersSkeleton() {
  return (
    <div className="min-h-screen bg-virgilio-cream" aria-busy="true" aria-label="Loading open roles">
      <div className="border-b border-black/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-4">
          <Skeleton className="h-6 w-32" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-4 w-3/4 max-w-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      </div>
      <div className="border-y border-black/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap gap-3">
          <Skeleton className="h-9 flex-1 min-w-[220px] max-w-md rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  )
}
