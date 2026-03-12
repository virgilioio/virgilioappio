import { useEffect, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { RejectionReasonSelector } from '@/components/candidates/RejectionReasonSelector'
import { useApplicationReview, RejectionConfig } from '@/hooks/useApplicationReview'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ThumbsDown,
  SkipForward,
  ArrowRight,
  Settings2,
  CheckCircle2,
  MapPin,
  Calendar,
  Globe,
  Briefcase,
  FileText,
  Sparkles,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

interface ApplicationReviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  jobTitle: string
  onComplete?: () => void
}

export function ApplicationReviewSheet({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  onComplete,
}: ApplicationReviewSheetProps) {
  const review = useApplicationReview(jobId)
  const [configOpen, setConfigOpen] = useState(false)

  useEffect(() => {
    if (open) {
      review.loadQueue()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (review.stats.rejected > 0 || review.stats.advanced > 0) {
      review.invalidateQueries()
      onComplete?.()
    }
    onOpenChange(false)
  }

  const progressPercent = review.totalInQueue > 0
    ? ((review.currentIndex) / review.totalInQueue) * 100
    : 0

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col gap-0"
        showOverlay
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-surface-primary px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text-primary truncate">
                  Application Review
                </h2>
                <p className="text-xs text-text-secondary truncate">{jobTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!review.isComplete && review.totalInQueue > 0 && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {review.currentPosition} of {review.totalInQueue}
                </Badge>
              )}
              <button
                onClick={handleClose}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </button>
            </div>
          </div>
          {!review.isComplete && review.totalInQueue > 0 && (
            <Progress value={progressPercent} className="h-1 mt-2" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {review.isLoading ? (
            <LoadingState />
          ) : review.totalInQueue === 0 ? (
            <EmptyState onClose={handleClose} />
          ) : review.isComplete ? (
            <CompletionState stats={review.stats} onClose={handleClose} />
          ) : review.currentCandidate ? (
            <ScrollArea className="h-full">
              <div className="p-4 space-y-5">
                {/* Candidate Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {review.currentCandidate.candidateName}
                    </h3>
                    {review.currentCandidate.currentJobTitle && (
                      <p className="text-sm text-text-secondary">
                        {review.currentCandidate.currentJobTitle}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={review.currentIndex === 0}
                      onClick={() => review.navigateTo(review.currentIndex - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={review.currentIndex >= review.totalInQueue - 1}
                      onClick={() => review.navigateTo(review.currentIndex + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Metadata chips */}
                <div className="flex flex-wrap gap-2">
                  {(review.currentCandidate.locationCity || review.currentCandidate.locationCountry) && (
                    <Badge variant="outline" className="gap-1 text-xs font-normal">
                      <MapPin className="h-3 w-3" />
                      {[review.currentCandidate.locationCity, review.currentCandidate.locationCountry].filter(Boolean).join(', ')}
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1 text-xs font-normal">
                    <Calendar className="h-3 w-3" />
                    Applied {format(new Date(review.currentCandidate.appliedAt), 'MMM d, yyyy')}
                  </Badge>
                  {review.currentCandidate.source && (
                    <Badge variant="outline" className="gap-1 text-xs font-normal">
                      <Globe className="h-3 w-3" />
                      {review.currentCandidate.source}
                    </Badge>
                  )}
                  {review.currentCandidate.seniority && (
                    <Badge variant="outline" className="gap-1 text-xs font-normal">
                      <Briefcase className="h-3 w-3" />
                      {review.currentCandidate.seniority}
                    </Badge>
                  )}
                  {review.currentCandidate.linkedinUrl && (
                    <a
                      href={review.currentCandidate.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Badge variant="outline" className="gap-1 text-xs font-normal hover:bg-accent cursor-pointer">
                        LinkedIn ↗
                      </Badge>
                    </a>
                  )}
                </div>

                <Separator />

                {/* Application Responses */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-text-secondary" />
                    <h4 className="text-sm font-semibold text-text-primary">Application Responses</h4>
                  </div>
                  <CandidateApplicationResponses
                    candidateId={review.currentCandidate.candidateId}
                    jobId={jobId}
                  />
                </section>

                <Separator />

                {/* Resume */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-text-secondary" />
                    <h4 className="text-sm font-semibold text-text-primary">Resume</h4>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <CandidateResumeViewer
                      candidateId={review.currentCandidate.candidateId}
                      height={50}
                    />
                  </div>
                </section>

                <Separator />

                {/* AI Career Summary */}
                {review.currentCandidate.profileSummary && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-semibold text-text-primary">AI Career Summary</h4>
                    </div>
                    <div className="rounded-lg border border-border p-4 bg-surface-secondary/30">
                      <ProfileSummaryMarkdown content={review.currentCandidate.profileSummary} />
                    </div>
                  </section>
                )}

                {/* Bottom spacer for action bar */}
                <div className="h-20" />
              </div>
            </ScrollArea>
          ) : null}
        </div>

        {/* Action Bar - shown when reviewing candidates */}
        {!review.isLoading && !review.isComplete && review.currentCandidate && (
          <div className="flex-shrink-0 border-t border-border bg-surface-primary px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              {/* Rejection Config */}
              <Popover open={configOpen} onOpenChange={setConfigOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-text-secondary">
                    <Settings2 className="h-3.5 w-3.5" />
                    Reject settings
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80">
                  <RejectionConfigPanel
                    config={review.rejectionConfig}
                    onChange={review.persistRejectionConfig}
                  />
                </PopoverContent>
              </Popover>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={review.handleReject}
                  disabled={review.isActioning}
                >
                  {review.isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-3.5 w-3.5" />
                  )}
                  Reject
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={review.handlePass}
                  disabled={review.isActioning}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  Pass
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="gap-1.5"
                  onClick={review.handleAdvance}
                  disabled={review.isActioning || !review.firstStageId}
                >
                  {review.isActioning ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" />
                  )}
                  Advance{review.firstStageName ? ` → ${review.firstStageName}` : ''}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

/* Rejection Config Panel inside popover */
function RejectionConfigPanel({
  config,
  onChange,
}: {
  config: RejectionConfig
  onChange: (config: RejectionConfig) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-1">Rejection Settings</h4>
        <p className="text-xs text-text-secondary">
          These settings persist across rejections during this session.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Rejection Reason</Label>
        <RejectionReasonSelector
          value={config.rejectionReasonId}
          onValueChange={(value) => onChange({ ...config, rejectionReasonId: value })}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={config.rejectionNotes || ''}
          onChange={(e) => onChange({ ...config, rejectionNotes: e.target.value })}
          placeholder="Brief rejection note..."
          className="min-h-[60px] text-sm"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label className="text-xs cursor-pointer">Send rejection email</Label>
          <p className="text-[11px] text-text-secondary">Auto-send on reject</p>
        </div>
        <Switch
          checked={config.sendEmail}
          onCheckedChange={(checked) => onChange({ ...config, sendEmail: checked })}
        />
      </div>
    </div>
  )
}

/* Loading state */
function LoadingState() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

/* Empty state - no candidates in queue */
function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="rounded-full bg-surface-secondary p-4 mb-4">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        No applications to review
      </h3>
      <p className="text-sm text-text-secondary mb-6 max-w-sm">
        There are no candidates waiting in the application review queue for this job.
      </p>
      <Button onClick={onClose} variant="outline">
        Close
      </Button>
    </div>
  )
}

/* Completion state - finished all candidates */
function CompletionState({
  stats,
  onClose,
}: {
  stats: { rejected: number; passed: number; advanced: number }
  onClose: () => void
}) {
  const total = stats.rejected + stats.passed + stats.advanced

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="rounded-full bg-success/10 p-4 mb-4">
        <PartyPopper className="h-8 w-8 text-success" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">
        Review Complete!
      </h3>
      <p className="text-sm text-text-secondary mb-6">
        You reviewed {total} candidate{total !== 1 ? 's' : ''} in this session.
      </p>

      <div className="grid grid-cols-3 gap-4 mb-8 w-full max-w-sm">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-destructive">{stats.rejected}</div>
          <div className="text-xs text-text-secondary mt-0.5">Rejected</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-text-secondary">{stats.passed}</div>
          <div className="text-xs text-text-secondary mt-0.5">Passed</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-2xl font-bold text-success">{stats.advanced}</div>
          <div className="text-xs text-text-secondary mt-0.5">Advanced</div>
        </div>
      </div>

      <Button onClick={onClose}>
        Done
      </Button>
    </div>
  )
}
