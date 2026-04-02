import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { FileSearch, ChevronRight, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApplicationReviewCounts } from '@/hooks/useApplicationReviewCounts'

const getJobStatusVariant = (status: string) => {
  switch (status) {
    case 'open': return 'job-open' as const
    case 'draft': return 'job-draft' as const
    case 'closed': return 'job-closed' as const
    case 'archived': return 'job-archived' as const
    default: return 'job-draft' as const
  }
}

export function ApplicationReviewCard() {
  const { data: reviewCounts, isLoading } = useApplicationReviewCounts()
  const [showAll, setShowAll] = useState(false)

  const displayed = showAll ? reviewCounts : reviewCounts?.slice(0, 6)
  const hasMore = (reviewCounts?.length ?? 0) > 6

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSearch className="h-5 w-5" />
          Application Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            ))}
          </div>
        ) : !reviewCounts?.length ? (
          <GioEmptyState
            title="No applications to review"
            description="When candidates apply to your open jobs, they'll appear here for review."
          />
        ) : (
          <div className="space-y-2">
            {displayed?.map(item => (
              <Link
                key={item.jobId}
                to={`/jobs/${item.jobId}?tab=application-review`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start justify-between gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {item.jobTitle}
                    </span>
                    <Badge variant={getJobStatusVariant(item.jobStatus)}>
                      {item.jobStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {item.jobLocation && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{item.jobLocation}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {item.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show less' : `Show ${reviewCounts!.length - 6} more`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
