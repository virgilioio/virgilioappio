import { cn } from '@/lib/utils'

interface SearchResultsSkeletonProps {
  count?: number
  className?: string
}

export function SearchResultsSkeleton({ count = 5, className }: SearchResultsSkeletonProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-virgilio-border animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 bg-virgilio-border rounded animate-pulse" />
            <div className="h-2.5 w-1/2 bg-virgilio-border/70 rounded animate-pulse" />
            <div className="h-2.5 w-1/3 bg-virgilio-border/50 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}
