import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { FileSearch, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApplicationReviewCounts } from '@/hooks/useApplicationReviewCounts'

export function ApplicationReviewCard() {
  const { data: reviewCounts, isLoading } = useApplicationReviewCounts()

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
            {reviewCounts.slice(0, 6).map(item => (
              <Link
                key={item.jobId}
                to={`/jobs/${item.jobId}?tab=application-review`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-accent-foreground/20 transition-all group"
              >
                <span className="text-sm font-medium text-foreground truncate min-w-0">
                  {item.jobTitle}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                    {item.count}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
            {reviewCounts.length > 6 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{reviewCounts.length - 6} more jobs
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
