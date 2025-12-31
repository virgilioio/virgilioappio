import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

interface CandidateTableSkeletonProps {
  rows?: number
}

/**
 * List Row Skeleton (Dashboard Pattern)
 * Used for sourcing/candidate lists with avatar + text pattern
 */
export function CandidateTableSkeleton({ rows = 8 }: CandidateTableSkeletonProps) {
  return (
    <Card className="shadow-calendly">
      <CardContent className="p-4">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
