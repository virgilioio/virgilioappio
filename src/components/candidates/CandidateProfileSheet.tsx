import { useEffect, useState, useRef } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Badge } from '@/components/ui/badge'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateResumeViewer } from '@/components/candidates/CandidateResumeViewer'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CandidateWorkExperienceComponent } from '@/components/candidates/CandidateWorkExperience'
import { CandidateEducationComponent } from '@/components/candidates/CandidateEducationComponent'
import { useCandidateEnrichment } from '@/hooks/useCandidateEnrichment'
import { Edit, FileText, Clock, Download, ChevronLeft, ChevronRight, CheckCircle2, Circle, MoveRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

import { Link } from 'react-router-dom'
import { SafeHtml } from '@/components/ui/safe-html'
import { getSkillColor } from '@/utils/skillColors'
import { generateCandidatePdf } from '@/utils/candidatePdfGenerator'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { toast } from '@/hooks/use-toast'
import CandidateNameCard from '@/components/candidates/CandidateNameCard'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { useCandidateAttachments } from '@/hooks/useCandidateAttachments'
import { ResumeDropzone } from '@/components/candidates/ResumeDropzone'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import { cn } from '@/lib/utils'
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
}

export default function CandidateProfileSheet({ open, onOpenChange, candidateId, jobId, hasPrev, hasNext, onNavigatePrev, onNavigateNext, onStageChanged }: CandidateProfileSheetProps) {
  const { organizationId } = useAuth()
  const [loading, setLoading] = useState(false)
  const [candidate, setCandidate] = useState<any | null>(null)
  const [jobCandidate, setJobCandidate] = useState<any | null>(null)
  const [jobCandidateId, setJobCandidateId] = useState<string | null>(null)
  const [job, setJob] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<'job' | 'resume' | 'overview'>('job')
  const { workExperience, education, fetchCandidateEnrichmentData } = useCandidateEnrichment()
  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const { updateAssociationStatus, moveAssociationToStage, createAssociationAndMove } = usePipelineActions()
  const [associationId, setAssociationId] = useState<string | null>(null)
  const [associationStatus, setAssociationStatus] = useState<'active' | 'rejected' | 'hired' | null>(null)
  const [currentStageId, setCurrentStageId] = useState<string | null>(null)
  const [movingStageId, setMovingStageId] = useState<string | null>(null)
  const { attachments, uploadAttachment: uploadResume, isUploading: isResumeUploading, deleteAttachment } = useCandidateAttachments(jobCandidateId || '')

// Hiring plan stages for vertical accordion
const { loadHiringPlanInstances } = useJobHiringPlan()
type PlanStageOption = { jhsId: string; stage: JobStage; position: number }
const [planStages, setPlanStages] = useState<PlanStageOption[]>([])
const [openStageId, setOpenStageId] = useState<string | null>(null)
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

  useEffect(() => {
    if (open && candidateId) {
      fetchCandidateEnrichmentData(candidateId)
    }
  }, [open, candidateId, fetchCandidateEnrichmentData])

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

      // Resolve job candidate (record in job_candidates)
      let jc: any | null = null
      if (candidate.linkedin_url) {
        const { data } = await supabase
          .from('job_candidates')
          .select('*')
          .eq('job_id', jobId)
          .eq('linkedin_url', candidate.linkedin_url)
          .maybeSingle()
        jc = data || null
      }
      if (!jc) {
        const { data } = await supabase
          .from('job_candidates')
          .select('*')
          .eq('job_id', jobId)
          .eq('candidate_name', candidate.candidate_name)
          .maybeSingle()
        jc = data || null
      }
      if (jc) {
        setJobCandidate(jc)
        setJobCandidateId(jc.id)
      } else {
        setJobCandidate(null)
        setJobCandidateId(null)
      }

      // Resolve association for status/actions
      if (candidateId) {
        const { data: assoc } = await supabase
          .from('job_candidate_associations')
          .select('id, status, current_stage_id')
          .eq('job_id', jobId)
          .eq('candidate_id', candidateId)
          .maybeSingle()
        setAssociationId(assoc?.id ?? null)
        setAssociationStatus((assoc?.status as any) ?? null)
        setCurrentStageId((assoc as any)?.current_stage_id ?? null)
      }
    }
    loadRelated()
  }, [open, candidate, jobId, candidateId])

  const handleUpdateCandidate = async (candidateData: any) => {
    if (!jobCandidateId) return
    setEditLoading(true)
    try {
      const { email, phone, ...jobCandidateData } = candidateData
      const { data, error } = await supabase
        .from('job_candidates')
        .update(jobCandidateData)
        .eq('id', jobCandidateId)
        .select('*')
        .single()
      if (error) throw error
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
  }

  const handleMoveToOffer = async () => {
    try {
      const sorted = [...planStages].sort((a, b) => a.position - b.position)
      const offer = sorted.find(s => s.stage.stage_type === 'offer') || sorted.find(s => s.stage.stage_name?.toLowerCase().includes('offer'))
      if (!offer) {
        toast({ title: 'No offer stage', description: 'This job has no Offer stage in its hiring plan.', variant: 'destructive' })
        return
      }
      if (associationId) {
        await moveAssociationToStage(associationId, offer.jhsId)
      } else if (candidateId) {
        const newId = await createAssociationAndMove(jobId, candidateId, offer.jhsId)
        setAssociationId(newId)
      }
      setCurrentStageId(offer.jhsId)
      setOpenStageId(offer.stage.id)
      setActiveTab('job')
      onStageChanged?.()
    } catch (e) {
      // Error already handled with toast in hooks
    }
  }

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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[80vw] sm:max-w-none h-full p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div />
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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'job' | 'resume' | 'overview')}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left column (2x) */}
                  <div className="lg:col-span-2 space-y-6">
                    <CandidateNameCard
                      name={candidate.candidate_name}
                      linkedinUrl={candidate.linkedin_url}
                      badgeText={`${(job?.title ?? '')}${associationStatus && associationStatus !== 'active' ? ' • ' + (associationStatus[0].toUpperCase() + associationStatus.slice(1)) : ''}` || candidate.status}
                      tabs={[
                        { value: 'job', label: 'Job Application', Icon: FileText },
                        { value: 'resume', label: 'Resume', Icon: FileText },
                        { value: 'overview', label: 'Overview', Icon: FileText },
                        
                      ]}
                      activeTab={activeTab}
                      onTabChange={(v) => setActiveTab(v as 'job' | 'resume' | 'overview')}
                      rightActions={
                        <>
                          {/* Mark Hired only when in Offer stage */}
                          {(() => {
                            const current = planStages.find(s => s.jhsId === currentStageId)
                            const canMarkHired = !!associationId && associationStatus !== 'hired' && current?.stage.stage_type === 'offer'
                            return canMarkHired ? (
                              <Button
                                size="sm"
                                onClick={() => handleSetStatus('hired')}
                                title="Mark candidate as hired"
                              >
                                Mark Hired
                              </Button>
                            ) : null
                          })()}
                          <Button
                            variant="default"
                            size="icon"
                            className="aspect-square rounded-md bg-foreground text-background hover:bg-foreground"
                            onClick={() => generateCandidatePdf({ candidate, job })}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      }
                    />

                    {/* Job Application Tab */}
                    {activeTab === 'job' && (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">Job Application</CardTitle>
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
          {!isCurrent && (
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
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
                <MoveRight className="h-4 w-4 mr-2" />
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

                    {/* Resume Tab */}
                    {activeTab === 'resume' && (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">Resume</CardTitle>
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
                                <CandidateResumeViewer jobCandidateId={jobCandidateId} />
                              </>
                            ) : (
                              <ResumeDropzone onUpload={(file) => uploadResume(file, true)} isUploading={isResumeUploading} />
                            )
                          ) : (
                            <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {activeTab === 'overview' ? (
                      <>
                        {/* Candidate Information */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Candidate Information</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-xs text-text-tertiary">Location</div>
                                <div className="text-sm text-text-primary">
                                  {[candidate.location_city, candidate.location_state, candidate.location_country]
                                    .filter(Boolean)
                                    .join(', ') || 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-text-tertiary">Salary</div>
                                <div className="text-sm text-text-primary">
                                  {candidate.salary_amount ? `${candidate.salary_currency || 'USD'} ${Number(candidate.salary_amount).toLocaleString()} ${candidate.salary_period || ''}` : 'Not specified'}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-text-tertiary">Added</div>
                                <div className="text-sm text-text-primary">
                                  {new Date((jobCandidate?.created_at || candidate.created_at) as string).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Skills */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Skills</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(() => {
                              // Prefer job-specific skills, then independent candidate skills, then AI suggestions
                              const aiFromJob = Array.isArray((jobCandidate as any)?.auto_generated_skills)
                                ? ((jobCandidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                : []
                              const aiFromIndependent = Array.isArray((candidate as any)?.auto_generated_skills)
                                ? ((candidate as any).auto_generated_skills as any[]).map((s) => typeof s === 'string' ? s : s?.name).filter(Boolean)
                                : []
                              const preferred = (jobCandidate?.skills && jobCandidate.skills.length > 0)
                                ? jobCandidate.skills
                                : (candidate?.skills && candidate.skills.length > 0)
                                  ? candidate.skills
                                  : (aiFromJob.length > 0 ? aiFromJob : aiFromIndependent)

                              return preferred && preferred.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {preferred.map((s: string, i: number) => (
                                    <Badge key={`${s}-${i}`} variant={getSkillColor(s)} className="text-sm">{s}</Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-sm text-text-secondary">No skills specified</div>
                              )
                            })()}
                          </CardContent>
                        </Card>

                        {/* Profile Summary */}
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg">Profile Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
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
                        </Card>
                      </>
                    ) : (
                      <></>
                    )}
                  </div>

                  {/* Right column (1x) */}
                  <div className="space-y-6">
                    {/* Quick Actions */}
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {associationId || jobCandidateId ? (
                          <>
                            <Button className="w-full gap-sm" onClick={() => setEditOpen(true)}>
                              <Edit className="h-4 w-4" />
                              Edit Candidate
                            </Button>
                            {associationId && associationStatus && associationStatus !== 'active' && (
                              <Button variant="outline" className="w-full gap-sm" onClick={() => handleSetStatus('active')}>
                                Restore
                              </Button>
                            )}
                            {jobCandidateId && (
                              <>
                                <Link to={`/jobs/${jobId}/candidates/${jobCandidateId}`}>
                                  <Button variant="outline" className="w-full gap-sm">
                                    <FileText className="h-4 w-4" />
                                    Create Offer Letter
                                  </Button>
                                </Link>
                                <Link to={`/jobs/${jobId}/candidates/${jobCandidateId}`}>
                                  <Button variant="outline" className="w-full gap-sm">
                                    <Clock className="h-4 w-4" />
                                    Schedule
                                  </Button>
                                </Link>
                                <Button variant="outline" className="w-full gap-sm" onClick={handleMoveToOffer}>
                                  <MoveRight className="h-4 w-4" />
                                  Move to Offer
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-text-secondary">No job candidate record linked for actions.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Notes */}
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {organizationId && jobCandidateId ? (
                          <CandidateComments candidateId={jobCandidateId} jobId={jobId} organizationId={organizationId} />
                        ) : (
                          <div className="text-sm text-text-secondary">No job candidate record linked for comments.</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Job Information */}
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">Job Information</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-text-primary">{job?.title || '—'}</div>
                      </CardContent>
                    </Card>

                    {/* URLs */}
                    {jobCandidateId ? (
                      <CandidateUrls candidateId={jobCandidateId} />
                    ) : (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">URLs</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Attachments */}
                    {jobCandidateId ? (
                      <CandidateAttachments candidateId={jobCandidateId} />
                    ) : (
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg">Attachments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-sm text-text-secondary">No job candidate record linked.</div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </Tabs>
            )}
          <CandidateForm
            isOpen={editOpen}
            onClose={() => setEditOpen(false)}
            onSubmit={handleUpdateCandidate}
            candidate={jobCandidate}
            jobId={jobId}
            isLoading={editLoading}
          />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
