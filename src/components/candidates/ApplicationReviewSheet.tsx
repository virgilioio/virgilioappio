import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { ProfileSummaryMarkdown } from '@/components/candidates/ProfileSummaryMarkdown'
import { RejectionReasonSelector } from '@/components/candidates/RejectionReasonSelector'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { SafeHtml } from '@/components/ui/safe-html'
import { useApplicationReview, RejectionConfig } from '@/hooks/useApplicationReview'
import { useRejectionEmailTemplates } from '@/hooks/useRejectionEmailTemplates'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ThumbsDown,
  SkipForward,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Calendar,
  Globe,
  Briefcase,
  Sparkles,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { format } from 'date-fns'

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
        className="w-[96vw] sm:max-w-none p-0 flex flex-col gap-0"
        showOverlay
      >
        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {review.isLoading ? (
            <LoadingState />
          ) : review.isComplete ? (
            <CompletionState stats={review.stats} onClose={handleClose} />
          ) : review.totalInQueue === 0 ? (
            <EmptyState onClose={handleClose} />
          ) : review.currentCandidate ? (
            <div className="h-full flex flex-col">
              {/* Candidate Header */}
              <SheetHeader className="p-6 border-b flex-shrink-0">
                <div className="flex items-center justify-between flex-1">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                        {review.currentCandidate.candidateName}
                        <span className="text-purple-period">.</span>
                      </h2>
                      {review.currentCandidate.linkedinUrl && (
                        <Button
                          variant="outline"
                          className="h-8 w-8 p-0"
                          onClick={() => window.open(review.currentCandidate!.linkedinUrl!, '_blank')}
                          aria-label="Open LinkedIn profile"
                        >
                          <LinkedInFilled className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                    {/* Job title below candidate name */}
                    <p className="text-sm text-text-secondary">{jobTitle}</p>
                    {/* Metadata chips */}
                    <div className="flex flex-wrap items-center gap-2">
                      {review.currentCandidate.currentJobTitle && (
                        <Badge variant="secondary" className="w-fit">
                          {review.currentCandidate.currentJobTitle}
                        </Badge>
                      )}
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
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    {!review.isComplete && review.totalInQueue > 0 && (
                      <Badge variant="secondary" className="text-xs font-medium">
                        {review.currentPosition} of {review.totalInQueue}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                      onClick={() => review.navigateTo(review.currentIndex - 1)}
                      disabled={review.currentIndex === 0}
                      title="Previous candidate"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 sm:gap-sm text-text-secondary hover:text-text-primary px-2 sm:px-3"
                      onClick={() => review.navigateTo(review.currentIndex + 1)}
                      disabled={review.currentIndex >= review.totalInQueue - 1}
                      title="Next candidate"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <button
                      onClick={handleClose}
                      className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ml-2"
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </button>
                  </div>
                </div>
                {!review.isComplete && review.totalInQueue > 0 && (
                  <Progress value={progressPercent} className="h-1 mt-2" />
                )}
              </SheetHeader>

              {/* 3-Column Grid: Resume (3) | Responses (3) | Controls (2) */}
              <div className="flex-1 min-h-0 grid grid-cols-8 gap-0">
                {/* Column 1 — Resume (4/8) */}
                <div className="col-span-4 border-r border-border flex flex-col min-h-0">
                  <ScrollArea className="flex-1">
                    <div className="p-6 space-y-5">
                      <div className="rounded-lg border border-border overflow-hidden">
                        <CandidateResumeViewer
                          candidateId={review.currentCandidate.candidateId}
                          height={70}
                        />
                      </div>

                    </div>
                  </ScrollArea>
                </div>

                {/* Column 2 — Application Responses & AI Summary (2/8) */}
                {/* Column 2 — Application Responses & AI Summary (2/8) */}
                <div className="col-span-2 border-r border-border flex flex-col min-h-0 overflow-hidden">
                  <Card className="flex flex-col min-h-0 border-0 border-r-0 rounded-none shadow-none">
                    <Tabs defaultValue="responses" className="flex flex-col min-h-0">
                      <CardHeader className="flex-shrink-0">
                        <TabsList className="w-full overflow-x-auto">
                          <TabsTrigger value="responses" className="flex-1">Application Responses</TabsTrigger>
                          <TabsTrigger value="ai-summary" className="flex-1 gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            AI Career Summary
                          </TabsTrigger>
                        </TabsList>
                      </CardHeader>
                      <TabsContent value="responses" className="flex-1 min-h-0 mt-0">
                        <ScrollArea className="h-[calc(100vh-280px)]">
                          <CardContent>
                            <CandidateApplicationResponses
                              candidateId={review.currentCandidate.candidateId}
                              jobId={jobId}
                            />
                          </CardContent>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="ai-summary" className="flex-1 min-h-0 mt-0">
                        <ScrollArea className="h-[calc(100vh-280px)]">
                          <CardContent>
                            {review.currentCandidate.profileSummary ? (
                              <ProfileSummaryMarkdown content={review.currentCandidate.profileSummary} />
                            ) : (
                              <p className="text-sm text-text-secondary">No AI career summary available for this candidate.</p>
                            )}
                          </CardContent>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </Card>
                </div>

                {/* Column 3 — Review Controls (2/8) */}
                <div className="col-span-2 flex flex-col min-h-0 overflow-hidden">
                  <ScrollArea className="flex-1">
                    <div className="p-5 space-y-4">
                      {/* Actions Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 gap-1.5"
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
                              className="flex-1 gap-1.5"
                              onClick={review.handlePass}
                              disabled={review.isActioning}
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              Pass
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              className="flex-1 gap-1.5"
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
                        </CardContent>
                      </Card>

                      {/* Rejection Settings Card */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Rejection Settings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <RejectionConfigPanel
                            config={review.rejectionConfig}
                            onChange={review.persistRejectionConfig}
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* Rejection Config Panel — rendered inline in column 3 */
function RejectionConfigPanel({
  config,
  onChange,
}: {
  config: RejectionConfig
  onChange: (config: RejectionConfig) => void
}) {
  const { templates, isLoading: templatesLoading } = useRejectionEmailTemplates('organization')

  return (
    <div className="space-y-4">
      {/* Rejection Reason */}
      <div className="space-y-2">
        <Label className="text-xs">Rejection Reason</Label>
        <RejectionReasonSelector
          value={config.rejectionReasonId}
          onValueChange={(value) => onChange({ ...config, rejectionReasonId: value })}
        />
      </div>

      {/* Send Email Toggle */}
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

      {/* Email Template (visible when toggle is on) */}
      {config.sendEmail && (
        <div className="space-y-2">
          <Label className="text-xs">Rejection Email Template</Label>
          <Select
            value={config.rejectionEmailTemplateId || ''}
            onValueChange={(value) => onChange({ ...config, rejectionEmailTemplateId: value || undefined })}
          >
            <SelectTrigger className="text-sm">
              <SelectValue placeholder={templatesLoading ? 'Loading...' : 'Select template'} />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Email Preview (visible when toggle is on + template selected) */}
      {config.sendEmail && config.rejectionEmailTemplateId && (() => {
        const selectedTemplate = templates.find(t => t.id === config.rejectionEmailTemplateId)
        if (!selectedTemplate) return null
        return (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 max-h-[200px] overflow-y-auto">
            <div>
              <p className="text-[11px] text-text-secondary font-medium uppercase tracking-wide">Subject</p>
              <p className="text-xs text-text-primary">{selectedTemplate.subject}</p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-[11px] text-text-secondary font-medium uppercase tracking-wide mb-1">Body</p>
              <SafeHtml content={selectedTemplate.body} className="text-xs text-text-primary leading-relaxed prose-sm" />
            </div>
          </div>
        )
      })()}

      {/* Notes */}
      <div className="space-y-2">
        <Label className="text-xs">Notes (optional)</Label>
        <Textarea
          value={config.rejectionNotes || ''}
          onChange={(e) => onChange({ ...config, rejectionNotes: e.target.value })}
          placeholder="Brief rejection note..."
          className="min-h-[60px] text-sm"
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
    </div>
  )
}

/* Empty state */
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

/* Completion state */
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
