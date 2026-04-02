import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { FileSearch, ChevronRight, MapPin, ExternalLink, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApplicationReviewCounts } from '@/hooks/useApplicationReviewCounts'
import { WidgetSize } from '@/hooks/useDashboardLayout'

interface ApplicationReviewCardProps {
  size?: WidgetSize
}

const getJobStatusVariant = (status: string) => {
  switch (status) {
    case 'open': return 'job-open' as const
    case 'draft': return 'job-draft' as const
    case 'closed': return 'job-closed' as const
    case 'archived': return 'job-archived' as const
    default: return 'job-draft' as const
  }
}

export function ApplicationReviewCard({ size = 'small' }: ApplicationReviewCardProps) {
  const { data: reviewCounts, isLoading } = useApplicationReviewCounts()
  const [showAll, setShowAll] = useState(false)

  const totalPending = reviewCounts?.reduce((sum, r) => sum + r.count, 0) ?? 0
  const jobsWithReviews = reviewCounts?.length ?? 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Application Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  // ── Small: count + urgency summary ──
  if (size === 'small') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Application Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!reviewCounts?.length ? (
            <GioEmptyState
              title="No applications to review"
              description="New applications will appear here."
            />
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-2xl font-semibold text-foreground">{totalPending}</p>
                  <p className="text-xs text-muted-foreground">Pending reviews</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-lg font-semibold text-foreground">{jobsWithReviews}</p>
                  <p className="text-xs text-muted-foreground">{jobsWithReviews === 1 ? 'Job' : 'Jobs'}</p>
                </div>
              </div>
              {totalPending > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{totalPending} candidate{totalPending !== 1 ? 's' : ''} awaiting review</span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Medium: count + short candidate review queue ──
  if (size === 'medium') {
    const displayed = reviewCounts?.slice(0, 4)
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileSearch className="h-4 w-4 text-muted-foreground" />
              Application Review
            </CardTitle>
            {totalPending > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {totalPending}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!reviewCounts?.length ? (
            <GioEmptyState
              title="No applications to review"
              description="When candidates apply to your open jobs, they'll appear here for review."
            />
          ) : (
            <div className="space-y-1.5">
              {displayed?.map(item => (
                <Link
                  key={item.jobId}
                  to={`/jobs/${item.jobId}?tab=application-review`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:bg-accent hover:border-accent-foreground/20 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{item.jobTitle}</span>
                    {item.jobLocation && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />{item.jobLocation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
              {(reviewCounts?.length ?? 0) > 4 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  +{reviewCounts!.length - 4} more jobs with pending reviews
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // ── Large: fuller review list with richer context ──
  const displayed = showAll ? reviewCounts : reviewCounts?.slice(0, 8)
  const hasMore = (reviewCounts?.length ?? 0) > 8

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileSearch className="h-4 w-4 text-muted-foreground" />
            Application Review
          </CardTitle>
          <div className="flex items-center gap-2">
            {totalPending > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                {totalPending} pending
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!reviewCounts?.length ? (
          <GioEmptyState
            title="No applications to review"
            description="When candidates apply to your open jobs, they'll appear here for review."
          />
        ) : (
          <div className="space-y-1.5">
            {/* Table-like header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <span>Job</span>
              <span>Location</span>
              <span>Status</span>
              <span className="text-right">Pending</span>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              {displayed?.map((item, idx) => (
                <Link
                  key={item.jobId}
                  to={`/jobs/${item.jobId}?tab=application-review`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-3 py-2.5 hover:bg-accent transition-colors group ${idx < (displayed?.length ?? 0) - 1 ? 'border-b border-border' : ''}`}
                >
                  <span className="text-sm font-medium text-foreground truncate">{item.jobTitle}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {item.jobLocation || '—'}
                  </span>
                  <Badge variant={getJobStatusVariant(item.jobStatus)} className="text-[10px] shrink-0">
                    {item.jobStatus}
                  </Badge>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-1 text-xs"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'Show less' : `Show ${reviewCounts!.length - 8} more`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
