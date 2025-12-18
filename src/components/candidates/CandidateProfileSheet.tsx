import { useEffect, useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { CandidateJobSidebar } from '@/components/candidates/CandidateJobSidebar'
import { EnhancedSkillBadge } from '@/components/ui/enhanced-skill-badge'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateApplicationResponses } from '@/components/candidates/CandidateApplicationResponses'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CandidateWorkExperienceComponent, CandidateWorkExperience } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent, CandidateEducation } from '@/components/candidates/CandidateEducationComponent'
import { Edit, FileText, Clock, Download, ChevronLeft, ChevronRight, CheckCircle2, Circle, MoveRight, ThumbsDown, ThumbsUp, Star, Octagon, Mail, Phone, Copy, ExternalLink, Send, X, Check, RotateCcw, Activity, StickyNote, Sparkles, Calendar, Globe } from 'lucide-react'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

import { Link } from 'react-router-dom'
import { SafeHtml } from '@/components/ui/safe-html'
import { getSkillColor } from '@/utils/skillColors'
import { ScorecardSheet } from '@/components/candidates/ScorecardSheet'
import { useMyScorecards } from '@/hooks/useScorecards'
import { useAllStageScorecards } from '@/hooks/useAllStageScorecards'
import { ExpandableScoreDisplay } from '@/components/candidates/ExpandableScoreDisplay'
import { StageBookingsList } from '@/components/candidates/StageBookingsList'
import { generateCandidatePdf } from '@/utils/candidatePdfGenerator'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { toast } from '@/hooks/use-toast'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { copyToClipboard } from '@/utils/clipboard'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { useCandidateResolver } from '@/hooks/useCandidateResolver'
import { EnhancedResumeDropzone } from '@/components/candidates/EnhancedResumeDropzone'
import MoveToPipelineMenu from '@/components/candidates/MoveToPipelineMenu'
import { AddOrTransferCandidateDialog } from '@/components/candidates/AddOrTransferCandidateDialog'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import { cn } from '@/lib/utils'
import { MinimizableEmailComposer } from '@/components/candidates/MinimizableEmailComposer'
import { EmailHistoryList } from './EmailHistoryList'
import { ActivityFeedList } from './ActivityFeedList'
import { ScheduleInterviewSheet } from './ScheduleInterviewSheet'
import { GenerateBookingLinkButton } from '@/components/candidates/GenerateBookingLinkButton'
import { RejectionDialog } from './RejectionDialog'
import { RejectionStatusBanner } from './RejectionStatusBanner'
import { CreateOfferLetterSheet } from './CreateOfferLetterDialog'

interface StageScorecardProps {
  stageInstanceId: string;
  associationId: string;
  currentUserId?: string;
  onOpenFullSheet: (scorecardId: string) => void;
}

function StageScorecards({ stageInstanceId, associationId, currentUserId, onOpenFullSheet }: StageScorecardProps) {
  const { scorecards, loading } = useAllStageScorecards(stageInstanceId, associationId);

  if (loading) {
    return <div className="text-sm text-text-tertiary">Loading scorecards...</div>;
  }

  return (
    <ExpandableScoreDisplay
      scorecards={scorecards}
      currentUserId={currentUserId}
      onOpenFullSheet={onOpenFullSheet}
    />
  );
}

interface CandidateProfileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidateId: string | null
  jobId: string
  hasPrev?: boolean
  hasNext?: boolean
  onNavigatePrev?: () => void
  onNavigateNext?: () => void
  onStageChanged?: () => void
  autoOpenScorecard?: boolean
  onScorecardOpened?: () => void
}

export default function CandidateProfileSheet({ open, onOpenChange, candidateId, jobId, hasPrev, hasNext, onNavigatePrev, onNavigateNext, onStageChanged, autoOpenScorecard, onScorecardOpened }: CandidateProfileSheetProps) {
  const { organizationId, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [candidate, setCandidate] = useState<any | null>(null)
  const [jobCandidate, setJobCandidate] = useState<any | null>(null)
  const [jobCandidateId, setJobCandidateId] = useState<string | null>(null)
  const [job, setJob] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'job' | 'application' | 'resume' | 'overview'>('job')
  const [rightActiveTab, setRightActiveTab] = useState<'feed' | 'notes' | 'emails'>('feed')
  const [workExperience, setWorkExperience] = useState<CandidateWorkExperience[]>([])
  const [education, setEducation] = useState<CandidateEducation[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const { updateAssociationStatus, moveAssociationToStage, createAssociationAndMove } = usePipelineActions()
  const [associationId, setAssociationId] = useState<string | null>(null)
  const [associationStatus, setAssociationStatus] = useState<'active' | 'rejected' | 'hired' | 'offer' | null>(null)
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [rejectionDetails, setRejectionDetails] = useState<{
    rejectedAt: string | null;
    rejectedByName: string | null;
    rejectionReason: { id: string; name: string; category: string } | null;
    rejectionEmailSentAt: string | null;
    rejectionEmailScheduledFor: string | null;
  } | null>(null)
  const [viewingScorecardId, setViewingScorecardId] = useState<string | null>(null)
  const [viewingScorecard, setViewingScorecard] = useState<any>(null)
  const [movingStageId, setMovingStageId] = useState<string | null>(null)
  const [emailComposerOpen, setEmailComposerOpen] = useState(false)
  
  // Use the candidate resolver to get the correct ID for attachments
  const { independentCandidateId } = useCandidateResolver(candidateId)
  const { attachments, uploadAttachment: uploadResume, isUploading: isResumeUploading, deleteAttachment } = useCandidateAttachments(independentCandidateId || '')

// Hiring plan stages for vertical accordion
const { loadHiringPlanInstances } = useJobHiringPlan()
type PlanStageOption = { jhsId: string; stage: JobStage; position: number }
const [planStages, setPlanStages] = useState<PlanStageOption[]>([])
const [openStageId, setOpenStageId] = useState<string | null>(null)

// Scorecards
const { rows: myScorecards, byStage: myScorecardsByStage, upsertMyScorecard, refetch: refetchScorecards, deleteMyScorecard } = useMyScorecards(associationId)
const [scoreOpen, setScoreOpen] = useState(false)
const [scoreStageInstId, setScoreStageInstId] = useState<string | null>(null)
const [scoreStageName, setScoreStageName] = useState<string | undefined>(undefined)

// Schedule Interview
const [scheduleOpen, setScheduleOpen] = useState(false)
const [scheduleStageId, setScheduleStageId] = useState<string | null>(null)
const [scheduleStageName, setScheduleStageName] = useState<string>('')
const [oldBookingId, setOldBookingId] = useState<string | null>(null)

// Rejection Dialog
const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)

// Offer Form Sheet
const [offerFormOpen, setOfferFormOpen] = useState(false)
  // Resume helpers
  const resumeAttachment = attachments.find((a) => a.is_resume)
  const replaceResumeInputRef = useRef<HTMLInputElement>(null)
  const handleReplaceResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void uploadResume(file, true)
    }
    e.currentTarget.value = ''
  }
  const handleDeleteResume = async () => {
    if (!resumeAttachment) return
    await deleteAttachment(resumeAttachment.id, resumeAttachment.file_url)
  }

  useEffect(() => {
    if (open) setActiveTab('job')
    const load = async () => {
      if (!open || !candidateId) return
      setLoading(true)
      try {
        const { data } = await supabase
          .from('candidates')
          .select('*')
          .eq('id', candidateId)
          .single()
        setCandidate(data || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [open, candidateId])

  useEffect(() => {
    if (!open || !jobId) return
    ;(async () => {
      try {
        const stages = await loadHiringPlanInstances(jobId)
        setPlanStages(stages)
        if (stages && stages.length && openStageId === null) {
          setOpenStageId(stages[0].stage.id)
        }
      } catch (e) {
        console.error('Failed to load hiring plan stages', e)
      }
    })()
  }, [open, jobId, loadHiringPlanInstances])

  // Ensure the accordion opens the CURRENT stage by default and when stage changes
  useEffect(() => {
    if (!open || planStages.length === 0) return
    if (currentStageId) {
      const current = planStages.find(s => s.jhsId === currentStageId)
      if (current) {
        setOpenStageId(current.stage.id)
        return
      }
    }
    if (openStageId === null) {
      setOpenStageId(planStages[0].stage.id)
    }
    
    // Auto-open scorecard if requested via URL param
    if (autoOpenScorecard && currentStageId && associationId) {
      const currentStage = planStages.find(s => s.jhsId === currentStageId)
      if (currentStage && supportsScorecard(currentStage.stage.stage_type)) {
        setScoreStageInstId(currentStageId)
        setScoreStageName(currentStage.stage.stage_name)
        setScoreOpen(true)
        onScorecardOpened?.()
      }
    }
  }, [open, planStages, currentStageId])

  // Remove CoreSignal enrichment - work experience and education will be empty arrays for now

  useEffect(() => {
    const loadRelated = async () => {
      if (!open || !candidate || !jobId) return
      // Load job info
      const { data: jobData } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('id', jobId)
        .maybeSingle()
      setJob(jobData || null)

      // Job candidate data is now merged with the global candidate data
      // No separate job_candidates table lookup needed
      setJobCandidate(candidate)
      setJobCandidateId(candidate.id)

      // Resolve association for status/actions
      if (candidateId) {
        const { data: assoc } = await supabase
          .from('job_candidate_associations')
          .select(`
            id, 
            status, 
            current_stage_id,
            rejected_at,
            rejected_by,
            rejection_email_sent_at,
            rejection_email_scheduled_for,
            rejection_reason:rejection_reasons(id, name, category)
          `)
          .eq('job_id', jobId)
          .eq('candidate_id', candidateId)
          .maybeSingle()
        setAssociationId(assoc?.id ?? null)
        setAssociationStatus((assoc?.status as any) ?? null)
        setCurrentStageId((assoc as any)?.current_stage_id ?? null)
        
        // Set rejection details if rejected
        if (assoc?.status === 'rejected' && assoc?.rejected_at) {
          // Get rejected_by user name
          let rejectedByName = null
          if (assoc.rejected_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('user_id', assoc.rejected_by)
              .maybeSingle()
            if (profile) {
              rejectedByName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
            }
          }
          setRejectionDetails({
            rejectedAt: assoc.rejected_at,
            rejectedByName,
            rejectionReason: assoc.rejection_reason as any,
            rejectionEmailSentAt: assoc.rejection_email_sent_at,
            rejectionEmailScheduledFor: assoc.rejection_email_scheduled_for,
          })
        } else {
          setRejectionDetails(null)
        }
      }
    }
    loadRelated()
  }, [open, candidate, jobId, candidateId])

  // Fetch specific scorecard when viewing another user's submission
  useEffect(() => {
    const fetchViewingScorecard = async () => {
      if (viewingScorecardId && scoreOpen) {
        const { data } = await supabase
          .from('job_stage_scorecards')
          .select('*')
          .eq('id', viewingScorecardId)
          .single()
        setViewingScorecard(data || null)
      } else {
        setViewingScorecard(null)
      }
    }
    fetchViewingScorecard()
  }, [viewingScorecardId, scoreOpen])

  const handleUpdateCandidate = async (candidateData: any) => {
    if (!candidateId) return
    setEditLoading(true)
    try {
      // Update the global candidate record
      const { notes, ...globalCandidateData } = candidateData
      
      // Filter out any fields that don't belong in the candidates table
      const allowedCandidateFields = {
        candidate_name: globalCandidateData.candidate_name,
        email: globalCandidateData.email,
        phone: globalCandidateData.phone,
        location_country: globalCandidateData.location_country,
        location_state: globalCandidateData.location_state,
        location_city: globalCandidateData.location_city,
        salary_amount: globalCandidateData.salary_amount,
        salary_currency: globalCandidateData.salary_currency,
        salary_period: globalCandidateData.salary_period,
        profile_summary: globalCandidateData.profile_summary,
        linkedin_url: globalCandidateData.linkedin_url,
        skills: globalCandidateData.skills
      }
      
      // Remove undefined values
      const filteredCandidateData = Object.fromEntries(
        Object.entries(allowedCandidateFields).filter(([_, value]) => value !== undefined)
      )
      
      const { data, error } = await supabase
        .from('candidates')
        .update(filteredCandidateData)
        .eq('id', candidateId)
        .select('*')
        .single()
      if (error) throw error
      
      // Update association notes if provided
      if (notes !== undefined && associationId) {
        await supabase
          .from('job_candidate_associations')
          .update({ notes })
          .eq('id', associationId)
      }
      
      setCandidate(data)
      setJobCandidate(data)
      toast({ title: 'Success', description: 'Candidate updated successfully' })
      setEditOpen(false)
    } catch (err) {
      console.error('Error updating candidate:', err)
      toast({ title: 'Error', description: 'Failed to update candidate', variant: 'destructive' })
    } finally {
      setEditLoading(false)
    }
  }

  const handleSetStatus = async (s: 'active' | 'rejected' | 'hired') => {
    if (!associationId) return
    await updateAssociationStatus(associationId, s)
    setAssociationStatus(s)
    onStageChanged?.()
  }

  const handleMoveToOffer = async () => {
    try {
      if (!associationId) {
        // If no association yet, create a basic one with status 'offer'
        if (candidateId) {
          const { data, error } = await supabase
            .from('job_candidate_associations')
            .insert([{
              job_id: jobId,
              candidate_id: candidateId,
              status: 'offer',
            }])
            .select('id')
            .single()
          if (error) throw error
          setAssociationId(data!.id)
        } else {
          toast({ title: 'No candidate', description: 'Candidate not found for this job.', variant: 'destructive' })
          return
        }
      } else {
        await updateAssociationStatus(associationId, 'offer')
      }

      setAssociationStatus('offer')
      onStageChanged?.()
    } catch (e) {
      console.error('Move to Offers failed:', e)
      toast({ title: 'Error', description: 'Could not move candidate to Job Offers.', variant: 'destructive' })
    }
  }

  const handleReject = () => {
    if (associationId) {
      setRejectionDialogOpen(true)
    }
  }
  
  // Refetch association status and rejection details
  const refetchAssociationStatus = async () => {
    if (!candidateId || !jobId) return;
    
    const { data: assoc } = await supabase
      .from('job_candidate_associations')
      .select(`
        id, 
        status, 
        current_stage_id,
        rejected_at,
        rejected_by,
        rejection_email_sent_at,
        rejection_email_scheduled_for,
        rejection_reason:rejection_reasons(id, name, category)
      `)
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .maybeSingle();
    
    if (assoc) {
      setAssociationId(assoc.id);
      setAssociationStatus((assoc.status as any) ?? null);
      setCurrentStageId((assoc as any).current_stage_id ?? null);
      
      if (assoc.status === 'rejected' && assoc.rejected_at) {
        let rejectedByName = null;
        if (assoc.rejected_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', assoc.rejected_by)
            .maybeSingle();
          if (profile) {
            rejectedByName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;
          }
        }
        setRejectionDetails({
          rejectedAt: assoc.rejected_at,
          rejectedByName,
          rejectionReason: assoc.rejection_reason as any,
          rejectionEmailSentAt: assoc.rejection_email_sent_at,
          rejectionEmailScheduledFor: assoc.rejection_email_scheduled_for,
        });
      } else {
        setRejectionDetails(null);
      }
    }
  };
  
  const handleRejectionSuccess = async () => {
    await refetchAssociationStatus();
    onStageChanged?.();
  };
  
  const handleReactivate = () => {
    handleSetStatus('active')
    setRejectionDetails(null)
  }
  const handleHire = () => handleSetStatus('hired')

  const getHeaderBgClass = (type: string) => {
    switch (type) {
      case 'application':
        return 'bg-pastel-blue/20'
      case 'screening':
        return 'bg-info/20'
      case 'interview':
        return 'bg-pastel-purple/20'
      case 'assessment':
        return 'bg-warning/20'
      case 'reference_check':
        return 'bg-pastel-orange/20'
      case 'offer':
        return 'bg-success/20'
      case 'onboarding':
        return 'bg-pastel-green/20'
      default:
        return 'bg-secondary/20'
    }
  }

  const supportsScorecard = (type?: string) =>
    !!type && ['interview', 'screening', 'assessment'].includes(type)

  const scoreLabel = (value?: string) => {
    switch (value) {
      case 'definitely_no':
        return 'Definitely No'
      case 'no':
        return 'No'
      case 'yes':
        return 'Yes'
      case 'strong_yes':
        return 'Strong Yes'
      default:
        return '—'
    }
  }

  const handleJobChange = (newJobId: string) => {
    if (newJobId === jobId) return // Already viewing this job
    
    // Navigate to the new job with the same candidate
    const url = new URL(window.location.href)
    url.pathname = `/jobs/${newJobId}`
    url.searchParams.set('candidate', candidateId!)
    window.location.href = url.toString()
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[96vw] sm:max-w-none h-full p-0" showOverlay={false}>
        <div className="flex h-full w-full">
          {/* Job Navigation Sidebar */}
          {candidateId && (
            <CandidateJobSidebar
              candidateId={candidateId}
              currentJobId={jobId}
              onJobSelect={handleJobChange}
            />
          )}

          {/* Main Profile Content */}
          <div className="flex-1 flex flex-col min-w-0">
            <SheetHeader className="p-6 border-b">
              <div className="flex items-center justify-between flex-1">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-poppins font-bold tracking-page-title text-text-primary text-4xl">
                    {candidate?.candidate_name || 'Loading...'}
                    <span className="text-purple-period">.</span>
                  </h2>
                  {candidate?.linkedin_url && (
                    <Button
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(candidate.linkedin_url, '_blank')}
                      aria-label="Open LinkedIn profile"
                    >
                      <LinkedInFilled className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {job?.title && (
                  <Badge variant="secondary" className="w-fit">
                    {`${job.title}${associationStatus && associationStatus !== 'active' ? ' • ' + (associationStatus[0].toUpperCase() + associationStatus.slice(1)) : ''}`}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-sm">
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  title="Previous candidate"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  className="gap-sm text-text-secondary hover:text-text-primary"
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  title="Next candidate"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="text-text-secondary text-sm">Loading profile…</div>
            ) : !candidate ? (
              <div className="text-text-secondary text-sm">No data available.</div>
            ) : (
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'job' | 'application' | 'resume' | 'overview')}>
                  {/* Rejection Status Banner - Full width above both columns */}
                  {associationStatus === 'rejected' && rejectionDetails && (
                    <div className="mb-6">
                      <RejectionStatusBanner
                        rejectedAt={rejectionDetails.rejectedAt}
                        rejectedByName={rejectionDetails.rejectedByName || undefined}
                        rejectionReason={rejectionDetails.rejectionReason}
                        onReactivate={handleReactivate}
                      />
                    </div>
                  )}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {/* Left column (50%) */}
                   <div className="space-y-6">
                     {/* Controls Card */}
                      <Card className="bg-surface-primary border-border">
                        <CardContent className="p-4">
                           <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                {candidate.job_board_source && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Globe className="h-3 w-3" />
                                    Applied via {candidate.job_board_source}
                                  </Badge>
                                )}
                                {/* Move to Pipeline button for suggested candidates */}
                                {!associationId && jobId && candidate.id && (
                                  <MoveToPipelineMenu
                                    jobId={jobId}
                                    candidateId={candidate.id}
                                    buttonText="Move to pipeline"
                                  />
                                )}
                                
                                {/* Add/Transfer button for candidates already in the job */}
                                {associationId && jobId && candidate.id && job && (
                                  <AddOrTransferCandidateDialog
                                    candidateId={candidate.id}
                                    candidateName={`${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'}
                                    currentJobId={jobId}
                                    currentJobTitle={job.title}
                                  />
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleMoveToOffer}
                                >
                                  <MoveRight className="h-4 w-4 mr-2" />
                                  Move to Offer
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={handleReject}
                                >
                                  <ThumbsDown className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                                {associationStatus === 'offer' && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleHire}
                                      className="text-success hover:text-success"
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Mark as Hired
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setOfferFormOpen(true)}
                                    >
                                      <FileText className="h-4 w-4 mr-2" />
                                      Offer Form
                                    </Button>
                                  </>
                                )}
                              </div>
                           </div>
                        </CardContent>
                     </Card>

                     <CandidateNameCard
                       email={candidate.email}
                       phone={candidate.phone}
                       tabs={[
                         { value: 'job', label: 'Job Application', Icon: FileText },
                         { value: 'application', label: 'Application Details', Icon: FileText },
                         { value: 'resume', label: 'Resume', Icon: FileText },
                         { value: 'overview', label: 'Overview', Icon: FileText },
                         
                       ]}
                       activeTab={activeTab}
                       onTabChange={(v) => setActiveTab(v as 'job' | 'application' | 'resume' | 'overview')}
                     />

                    {/* Job Application Tab */}
                    {activeTab === 'job' && (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle>Job Application</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {planStages.length ? (
                            <Accordion
                              type="single"
                              collapsible
                              value={openStageId ?? undefined}
                              onValueChange={(v) => setOpenStageId((v as string) || null)}
                              className="w-full space-y-2"
                            >
{(() => {
  const sorted = [...planStages].sort((a, b) => a.position - b.position)
  const currentIdx = currentStageId ? sorted.findIndex(s => s.jhsId === currentStageId) : -1
  return sorted.map((opt, idx) => {
    const isPast = currentIdx >= 0 && idx < currentIdx
    const isCurrent = currentIdx >= 0 && idx === currentIdx
    return (
      <AccordionItem key={opt.stage.id} value={opt.stage.id} className="border rounded-lg overflow-hidden">
        <AccordionTrigger className={cn('px-3 py-2 no-underline text-text-primary', getHeaderBgClass(opt.stage.stage_type))}>
          <div className="flex items-center gap-2">
            {isCurrent ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : isPast ? (
              <CheckCircle2 className="h-4 w-4 text-primary/40" />
            ) : (
              <Circle className="h-4 w-4 text-text-tertiary" />
            )}
            <div className="text-sm font-medium">{opt.stage.stage_name}</div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3">
          <div className="text-sm text-text-primary">
            {opt.stage.stage_description || 'No details for this stage yet.'}
          </div>

          {supportsScorecard(opt.stage.stage_type) && (
            <div className="mt-3 space-y-2">
              <StageScorecards 
                stageInstanceId={opt.jhsId}
                associationId={associationId!}
                currentUserId={user?.id}
                onOpenFullSheet={(scorecardId) => {
                  setScoreStageInstId(opt.jhsId)
                  setScoreStageName(opt.stage.stage_name)
                  setViewingScorecardId(scorecardId)
                  setScoreOpen(true)
                }}
              />
            </div>
          )}

          {/* Schedule Interview Button for screening/interview stages */}
          {/* Scheduled Interviews for this Stage */}
          {(opt.stage.stage_type === 'screening' || opt.stage.stage_type === 'interview') && candidateId && (
            <StageBookingsList 
              jhsId={opt.jhsId}
              candidateId={candidateId}
              onReschedule={(jhsId, bookingId) => {
                setScheduleStageId(jhsId);
                setScheduleStageName(opt.stage.stage_name);
                setOldBookingId(bookingId);
                setScheduleOpen(true);
              }}
            />
          )}

          {/* Action Buttons for Current Stage */}
          {isCurrent && (
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Schedule Interview Button - only for screening/interview stages */}
              {(opt.stage.stage_type === 'screening' || opt.stage.stage_type === 'interview') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScheduleStageId(opt.jhsId)
                    setScheduleStageName(opt.stage.stage_name)
                    setScheduleOpen(true)
                  }}
                  className="gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Interview
                </Button>
              )}
              
              {/* Generate Booking Link Button - for screening/interview stages with association */}
              {(opt.stage.stage_type === 'screening' || opt.stage.stage_type === 'interview') && associationId && candidateId && (
                <GenerateBookingLinkButton
                  jobId={jobId}
                  candidateId={candidateId}
                  jhsId={opt.jhsId}
                  associationId={associationId}
                  candidateName={candidate?.candidate_name}
                  candidateEmail={candidate?.email}
                  jobTitle={job?.title}
                  stageName={opt.stage.stage_name}
                />
              )}
              
              {/* Submit Scorecard Button - for all stages that support scorecards */}
              {supportsScorecard(opt.stage.stage_type) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setScoreStageInstId(opt.jhsId)
                    setScoreStageName(opt.stage.stage_name)
                    setScoreOpen(true)
                  }}
                  className="gap-2"
                >
                  <Star className="h-4 w-4" />
                  Submit Scorecard
                </Button>
              )}
            </div>
          )}

          {!isCurrent && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={movingStageId === opt.jhsId}
                onClick={async () => {
                  try {
                    setMovingStageId(opt.jhsId)
                    if (associationId) {
                      await moveAssociationToStage(associationId, opt.jhsId)
                    } else if (candidateId) {
                      const newId = await createAssociationAndMove(jobId, candidateId, opt.jhsId)
                      setAssociationId(newId)
                    }
                    setCurrentStageId(opt.jhsId)
                    setOpenStageId(opt.stage.id)
                    onStageChanged?.()
                  } catch (e) {
                    // Toasts are handled by hooks on error
                  } finally {
                    setMovingStageId(null)
                  }
                }}
              >
                <MoveRight className="h-4 w-4" />
                Move to this stage
              </Button>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      )
  })
})()}
                            </Accordion>
                          ) : (
                            <div className="text-sm text-text-secondary">No hiring stages configured for this job.</div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Application Details Tab */}
                    {activeTab === 'application' && (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle>Application Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CandidateApplicationResponses 
                            candidateId={candidateId!} 
                            jobId={jobId} 
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Resume Tab */}
                    {activeTab === 'resume' && (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle>Resume</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {jobCandidateId ? (
                            resumeAttachment ? (
                              <>
                                <div className="flex gap-2">
                                  <input
                                    ref={replaceResumeInputRef}
                                    type="file"
                                    className="hidden"
                                    onChange={handleReplaceResumeChange}
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                                  />
                                  <Button variant="outline" onClick={() => replaceResumeInputRef.current?.click()} disabled={isResumeUploading}>
                                    Replace Resume
                                  </Button>
                                  <Button variant="destructive" onClick={handleDeleteResume}>
                                    Delete Resume
                                  </Button>
                                </div>
                                <CandidateResumeViewer candidateId={independentCandidateId || candidateId} />
                              </>
                            ) : (
                              <EnhancedResumeDropzone 
                                onUpload={(file) => uploadResume(file, true)} 
                                isUploading={isResumeUploading}
                                candidateId={jobCandidateId || undefined}
                                showUpload={true}
                                parseOnly={false}
                              />
                            )
                          ) : (
                            <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {activeTab === 'overview' ? (
                      <Accordion type="multiple" defaultValue={['contact', 'summary']} className="space-y-4">
                        {/* Contact Information */}
                        <AccordionItem value="contact" className="border-0">
                          <Card className="bg-surface-primary border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline">
                              <CardTitle>Contact Information</CardTitle>
                            </AccordionTrigger>
                            <AccordionContent>
                              <CardContent className="space-y-4 pt-0">
                                    {/* Emails Section */}
                                    <div className="space-y-2">
                                      {/* Primary email or contact_emails */}
                                      {(candidate as any)?.contact_emails && (candidate as any).contact_emails.length > 0 ? (
                                        (candidate as any).contact_emails.map((ce: { type: string; email: string; status?: string }, idx: number) => (
                                          <div key={`email-${idx}`} className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                              <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                              <div className="flex flex-col min-w-0">
                                                <a
                                                  href={`mailto:${ce.email}`}
                                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                                >
                                                  {ce.email}
                                                </a>
                                                <span className="text-xs text-text-tertiary capitalize">{ce.type}</span>
                                              </div>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 flex-shrink-0"
                                              onClick={() => copyToClipboard(ce.email, 'Email copied to clipboard')}
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ))
                                      ) : candidate?.email ? (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <Mail className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                            <a
                                              href={`mailto:${candidate.email}`}
                                              className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                            >
                                              {candidate.email}
                                            </a>
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 flex-shrink-0"
                                            onClick={() => copyToClipboard(candidate.email, 'Email copied to clipboard')}
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      ) : null}
                                    </div>

                                    {/* Phones Section */}
                                    <div className="space-y-2">
                                      {(candidate as any)?.contact_phones && (candidate as any).contact_phones.length > 0 ? (
                                        (candidate as any).contact_phones.map((cp: { type: string; number: string }, idx: number) => (
                                          <div key={`phone-${idx}`} className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                              <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                              <div className="flex flex-col min-w-0">
                                                <a
                                                  href={`tel:${cp.number}`}
                                                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                                >
                                                  {cp.number}
                                                </a>
                                                <span className="text-xs text-text-tertiary capitalize">{cp.type}</span>
                                              </div>
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 flex-shrink-0"
                                              onClick={() => copyToClipboard(cp.number, 'Phone number copied to clipboard')}
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <Phone className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                            {candidate?.phone ? (
                                              <a
                                                href={`tel:${candidate.phone}`}
                                                className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                              >
                                                {candidate.phone}
                                              </a>
                                            ) : (
                                              <span className="text-sm text-text-tertiary italic">
                                                Phone not available
                                              </span>
                                            )}
                                          </div>
                                          {candidate?.phone && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 flex-shrink-0"
                                              onClick={() => copyToClipboard(candidate.phone, 'Phone number copied to clipboard')}
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* LinkedIn */}
                                    {candidate?.linkedin_url && (
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          <LinkedInFilled className="h-4 w-4 text-text-secondary mt-0.5 flex-shrink-0" />
                                          <a
                                            href={candidate.linkedin_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
                                          >
                                            LinkedIn Profile
                                          </a>
                                        </div>
                                        <ExternalLink className="h-3.5 w-3.5 text-text-tertiary flex-shrink-0 mt-0.5" />
                                      </div>
                                    )}
                              </CardContent>
                            </AccordionContent>
                          </Card>
                        </AccordionItem>

                        {/* URLs */}
                        <AccordionItem value="urls" className="border-0">
                          {independentCandidateId || candidateId ? (
                            <CandidateUrls candidateId={independentCandidateId || candidateId!} />
                          ) : (
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <CardTitle>URLs</CardTitle>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  <div className="text-sm text-text-secondary">No candidate data available.</div>
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          )}
                        </AccordionItem>

                        {/* Attachments */}
                        <AccordionItem value="attachments" className="border-0">
                          {independentCandidateId || candidateId ? (
                            <CandidateAttachments candidateId={independentCandidateId || candidateId!} />
                          ) : (
                            <Card className="bg-surface-primary border-border">
                              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                                <CardTitle>Attachments</CardTitle>
                              </AccordionTrigger>
                              <AccordionContent>
                                <CardContent className="pt-0">
                                  <div className="text-sm text-text-secondary">No candidate data available.</div>
                                </CardContent>
                              </AccordionContent>
                            </Card>
                          )}
                        </AccordionItem>

                        {/* Skills */}
                        <AccordionItem value="skills" className="border-0">
                          <Card className="bg-surface-primary border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline">
                              <div className="flex items-center justify-between flex-1 pr-4">
                                <CardTitle>Skills</CardTitle>
                                <div className="text-xs text-text-tertiary">
                                  Added {new Date((jobCandidate?.created_at || candidate.created_at) as string).toLocaleDateString()}
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <CardContent className="pt-0">
                                {(() => {
                                  // Use manual skills if available, otherwise use auto-generated skills
                                  const manualSkills = candidate?.skills || []
                                  const autoGenerated = Array.isArray((candidate as any)?.auto_generated_skills)
                                    ? ((candidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                    : []
                                  
                                  const displaySkills = manualSkills.length > 0 ? manualSkills : autoGenerated

                                  return displaySkills && displaySkills.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                      {displaySkills.map((s: string, i: number) => (
                                        <EnhancedSkillBadge 
                                          key={`${s}-${i}`} 
                                          skill={s}
                                          analysis={{
                                            matchRelevance: candidate?.match_score ? Math.round(candidate.match_score) : undefined
                                          }}
                                          variant="compact"
                                          showTooltip={true}
                                          interactive={false}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-sm text-text-secondary">No skills specified</div>
                                  )
                                })()}
                              </CardContent>
                            </AccordionContent>
                          </Card>
                        </AccordionItem>

                        {/* Profile Summary */}
                        <AccordionItem value="summary" className="border-0">
                          <Card className="bg-surface-primary border-border">
                            <AccordionTrigger className="px-6 py-4 hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <CardTitle>Profile Summary</CardTitle>
                                <Sparkles className="h-4 w-4 text-purple-500 flex-shrink-0" />
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <CardContent className="pt-0">
                                {candidate.profile_summary ? (
                                  <div className="prose prose-sm max-w-none text-text-primary">
                                    <SafeHtml
                                      content={candidate.profile_summary}
                                      className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                                    />
                                  </div>
                                ) : (
                                  <div className="text-sm text-text-secondary">No summary available.</div>
                                )}
                              </CardContent>
                            </AccordionContent>
                          </Card>
                        </AccordionItem>
                      </Accordion>
                    ) : (
                      <></>
                    )}
                   </div>

                   {/* Right column (1x) */}
                   <div className="space-y-6">
                     {/* Controls Card - Right Side */}
                     <Card className="bg-surface-primary border-border">
                       <CardContent className="p-4">
                         <div className="flex items-center justify-between w-full">
                           <div className="flex items-center gap-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => setEditOpen(true)}
                             >
                               <Edit className="h-4 w-4 mr-2" />
                               Edit
                             </Button>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={async () => {
                                 try {
                                   await generateCandidatePdf({ candidate, job })
                                   toast({ 
                                     title: 'Success', 
                                     description: 'Profile PDF downloaded successfully' 
                                   })
                                 } catch (error) {
                                   console.error('PDF generation failed:', error)
                                   toast({ 
                                     title: 'Error', 
                                     description: 'Failed to generate PDF. Please try again.', 
                                     variant: 'destructive' 
                                   })
                                 }
                               }}
                             >
                               <Download className="h-4 w-4 mr-2" />
                               Download
                             </Button>
                           </div>
                           
                           <Separator orientation="vertical" className="h-6" />
                           
                           <div className="flex items-center gap-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => setRightActiveTab('notes')}
                             >
                               <StickyNote className="h-4 w-4 mr-2" />
                               Add Note
                             </Button>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => setEmailComposerOpen(true)}
                             >
                               <Mail className="h-4 w-4 mr-2" />
                               Send Email
                             </Button>
                           </div>
                         </div>
                       </CardContent>
                     </Card>

                     {/* Tab Navigation */}
                     <CandidateNameCard
                       email={candidate.email}
                       phone={candidate.phone}
                       tabs={[
                         { value: 'feed', label: 'Feed', Icon: Activity },
                         { value: 'notes', label: 'Notes', Icon: StickyNote },
                         { value: 'emails', label: 'Emails', Icon: Mail },
                       ]}
                       activeTab={rightActiveTab}
                       onTabChange={(v) => setRightActiveTab(v as 'feed' | 'notes' | 'emails')}
                     />

                     {/* Feed Tab */}
                     {rightActiveTab === 'feed' && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle>Activity Feed</CardTitle>
                          </CardHeader>
                         <CardContent className="p-0">
                           <ScrollArea className="h-[500px]">
                             <div className="p-6">
                               <ActivityFeedList 
                                 candidateId={candidate.id}
                                 jobId={jobId}
                               />
                             </div>
                           </ScrollArea>
                         </CardContent>
                       </Card>
                     )}

                     {/* Notes Tab */}
                     {rightActiveTab === 'notes' && (
                       <>
                         {organizationId && candidateId ? (
                           <CandidateComments candidateId={candidateId} jobId={jobId} organizationId={organizationId} />
                         ) : (
                            <Card className="bg-surface-primary border-border">
                              <CardHeader>
                                <CardTitle>Notes</CardTitle>
                              </CardHeader>
                             <CardContent>
                               <div className="text-sm text-text-secondary">No candidate data available.</div>
                             </CardContent>
                           </Card>
                         )}
                       </>
                     )}

                      {/* Emails Tab */}
                      {rightActiveTab === 'emails' && (
                         <Card className="bg-surface-primary border-border">
                           <CardHeader>
                             <CardTitle>Email History</CardTitle>
                           </CardHeader>
                          <CardContent className="p-0">
                            <ScrollArea className="h-[500px]">
                              <div className="p-6">
                                <EmailHistoryList 
                                  candidateId={candidate.id} 
                                  jobId={jobId}
                                />
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      )}

                      {/* Job Information */}
                       <Card className="bg-surface-primary border-border">
                         <CardHeader>
                           <CardTitle>Job Information</CardTitle>
                         </CardHeader>
                        <CardContent>
                          <div className="text-sm text-text-primary">{job?.title || '—'}</div>
                        </CardContent>
                      </Card>
                  </div>
                </div>
              </Tabs>
            )}
          <CandidateFormSheet
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSubmit={handleUpdateCandidate}
            candidate={jobCandidate}
            jobId={jobId}
            isLoading={editLoading}
          />

          {scoreStageInstId && associationId && (
            <ScorecardSheet
              open={scoreOpen}
              onOpenChange={(o) => {
                setScoreOpen(o)
                if (!o) {
                  setScoreStageInstId(null)
                  setViewingScorecardId(null)
                }
              }}
              stageName={scoreStageName}
              associationId={associationId}
              stageInstanceId={scoreStageInstId}
              existing={viewingScorecard || myScorecardsByStage[scoreStageInstId] || null}
              isAuthor={!!(
                viewingScorecard 
                  ? user?.id === viewingScorecard.created_by 
                  : myScorecardsByStage[scoreStageInstId] && user?.id === myScorecardsByStage[scoreStageInstId].created_by
              )}
              onSubmit={async (rating, overview) => {
                await upsertMyScorecard(scoreStageInstId!, rating, overview || '')
                await refetchScorecards()
                setViewingScorecardId(null)
                toast({ title: 'Scorecard saved', description: 'Your scorecard has been saved.' })
              }}
              onDelete={async () => {
                const existingScorecard = viewingScorecard || myScorecardsByStage[scoreStageInstId]
                if (existingScorecard?.id) {
                  await deleteMyScorecard(existingScorecard.id)
                  await refetchScorecards()
                  setViewingScorecardId(null)
                }
              }}
            />
          )}

          {scheduleStageId && candidateId && (
            <ScheduleInterviewSheet
              open={scheduleOpen}
              onOpenChange={(open) => {
                setScheduleOpen(open);
                if (!open) setOldBookingId(null);
              }}
              candidateId={candidateId}
              candidateName={candidate?.candidate_name || ''}
              candidateEmail={candidate?.email || ''}
              candidatePhone={candidate?.phone}
              jobId={jobId}
              jobTitle={job?.title || 'Job'}
              organizationId={organizationId!}
              jhsId={scheduleStageId}
              stageName={scheduleStageName}
              associationId={associationId!}
              oldBookingId={oldBookingId}
            />
          )}

              </div>
            </div>
          </div>

      {/* Minimizable Email Composer (portal to body) */}
      <MinimizableEmailComposer
        isOpen={emailComposerOpen}
        onOpenChange={setEmailComposerOpen}
        candidateId={candidateId || undefined}
        jobId={jobId}
        defaultTo={candidate?.email}
        candidateName={candidate?.candidate_name}
        onSuccess={() => setEmailComposerOpen(false)}
        jhsId={currentStageId || undefined}
        associationId={associationId || undefined}
      />

      {/* Rejection Dialog */}
      {associationId && (
        <RejectionDialog
          open={rejectionDialogOpen}
          onOpenChange={(open) => {
            setRejectionDialogOpen(open);
            // Refetch association status when dialog closes to catch any changes
            if (!open && candidateId && jobId) {
              refetchAssociationStatus();
            }
          }}
          associationId={associationId}
          candidateName={candidate?.candidate_name || 'Candidate'}
          candidateEmail={candidate?.email || ''}
          candidateId={candidateId || undefined}
          jobId={jobId}
          onSuccess={handleRejectionSuccess}
        />
      )}
      
      {/* Offer Form Sheet */}
      {candidate && job && (
        <CreateOfferLetterSheet
          open={offerFormOpen}
          onOpenChange={setOfferFormOpen}
          candidate={candidate}
          job={job}
          organization={null}
        />
      )}
      </SheetContent>
    </Sheet>
  </>
  )
}
