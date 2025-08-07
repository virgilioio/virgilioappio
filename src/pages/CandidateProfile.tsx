import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { SafeHtml } from '@/components/ui/safe-html'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit, Zap, Linkedin, FileText, MessageSquare, ChevronLeft, ChevronRight, Clock, Download } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { AppContainer } from '@/components/layout/AppContainer'
import { useCandidates, Candidate } from '@/hooks/useCandidates'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useOrganizations } from '@/hooks/useOrganizations'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { cn } from '@/lib/utils'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'
import { CreateOfferLetterDialog } from '@/components/candidates/CreateOfferLetterDialog'
import { getSkillColor } from '@/utils/skillColors'
import { generateCandidatePdf } from '@/utils/candidatePdfGenerator'
import MoveToPipelineMenu from '@/components/candidates/MoveToPipelineMenu'
import { usePipelineActions } from '@/hooks/usePipelineActions'

export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const { user, organizationId } = useAuth()
  const { profile, isLoading: profileLoading } = useUserProfile()
  const { organizations, isLoading: organizationsLoading } = useOrganizations()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [job, setJob] = useState<any>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isOfferLetterDialogOpen, setIsOfferLetterDialogOpen] = useState(false)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'notes'>('overview')
  const { candidates, isLoading: candidatesLoading, updateCandidate } = useCandidates(jobId || '')
  const { getJob, isLoading: jobLoading } = useJobs()
  const { fetchAssociationsForJob } = usePipelineActions()
  const [independentCandidateId, setIndependentCandidateId] = useState<string | null>(null)
  const [associationsLoading, setAssociationsLoading] = useState(false)

  // Get the job's organization data from the database
  const jobOrganization = job?.organization_id 
    ? organizations.find(org => org.id === job.organization_id)
    : null

  // Navigation logic for previous/next candidates
  const currentCandidateIndex = candidates.findIndex(c => c.id === candidateId)
  const hasPreviousCandidate = currentCandidateIndex > 0
  const hasNextCandidate = currentCandidateIndex < candidates.length - 1
  const previousCandidate = hasPreviousCandidate ? candidates[currentCandidateIndex - 1] : null
  const nextCandidate = hasNextCandidate ? candidates[currentCandidateIndex + 1] : null

  const navigateToCandidate = (candidateId: string) => {
    // Force a full page refresh to ensure all state is properly reset
    window.location.href = `/jobs/${jobId}/candidates/${candidateId}`
  }

  useEffect(() => {
    if (jobId && candidateId && candidates.length > 0) {
      const foundCandidate = candidates.find(c => c.id === candidateId)
      
      console.log('CandidateProfile - Candidate state update:', {
        candidateId: candidateId,
        foundCandidate: foundCandidate?.candidate_name,
        currentCandidate: candidate?.candidate_name,
        candidatesLength: candidates.length
      })
      
      setCandidate(foundCandidate || null)
      
      // If form was open and candidate changed, close it to prevent showing wrong data
      if (isFormOpen && foundCandidate && candidate && foundCandidate.id !== candidate.id) {
        console.log('CandidateProfile - Closing form due to candidate change')
        setIsFormOpen(false)
      }
    }
  }, [candidates, candidateId, candidate, isFormOpen])

  // Force candidate state update when candidateId changes
  useEffect(() => {
    if (candidateId && candidates.length > 0) {
      const foundCandidate = candidates.find(c => c.id === candidateId)
      if (foundCandidate && (!candidate || candidate.id !== foundCandidate.id)) {
        console.log('CandidateProfile - Force updating candidate state for new candidateId:', {
          newCandidateId: candidateId,
          newCandidateName: foundCandidate.candidate_name
        })
        setCandidate(foundCandidate)
      }
    }
  }, [candidateId, candidates])

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
  }, [jobId])

  const loadJob = async () => {
    if (!jobId) return
    try {
      const jobData = await getJob(jobId)
      setJob(jobData)
    } catch (error) {
      console.error('Failed to load job:', error)
    }
  }

  useEffect(() => {
    const resolveIndependentCandidate = async () => {
      if (!jobId || !candidate) return
      setAssociationsLoading(true)
      try {
        const associations = await fetchAssociationsForJob(jobId)
        const match = associations.find(a =>
          (candidate.linkedin_url && a.linkedin_url && a.linkedin_url === candidate.linkedin_url) ||
          a.candidate_name === candidate.candidate_name
        )
        setIndependentCandidateId(match ? match.candidate_id : null)
      } catch (e) {
        setIndependentCandidateId(null)
      } finally {
        setAssociationsLoading(false)
      }
    }
    resolveIndependentCandidate()
  }, [jobId, candidate, fetchAssociationsForJob])

  const handleEdit = () => {
    console.log('CandidateProfile - Edit button clicked:', {
      candidateId: candidateId,
      candidateFromState: candidate?.id,
      candidateName: candidate?.candidate_name,
      isFormOpen: isFormOpen
    })

    // Defensive check: Ensure we have the correct candidate before opening the form
    if (!candidate || candidate.id !== candidateId) {
      console.warn('CandidateProfile - Edit attempted with mismatched candidate state:', {
        candidateId: candidateId,
        candidateFromState: candidate?.id,
        candidateName: candidate?.candidate_name
      })
      
      // Try to find the current candidate in the candidates array
      const currentCandidate = candidates.find(c => c.id === candidateId)
      if (currentCandidate) {
        console.log('CandidateProfile - Found current candidate in candidates array, updating state')
        setCandidate(currentCandidate)
        
        // Use a longer delay to ensure state update completes
        setTimeout(() => {
          console.log('CandidateProfile - Opening form after state update')
          setIsFormOpen(true)
        }, 200)
      } else {
        console.error('CandidateProfile - Could not find current candidate in candidates array')
        // Try to reload the candidates first
        return
      }
    } else {
      console.log('CandidateProfile - Opening edit form with correct candidate:', {
        candidateId: candidate.id,
        candidateName: candidate.candidate_name
      })
      setIsFormOpen(true)
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (!candidate) return
    const updatedCandidate = await updateCandidate(candidate.id, data)
    setCandidate(updatedCandidate as Candidate)
    setIsFormOpen(false)
  }

  const formatLocation = (candidate: Candidate) => {
    const parts = [candidate.location_city, candidate.location_state, candidate.location_country]
      .filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'Not specified'
  }

  const formatSalary = (candidate: Candidate) => {
    if (!candidate.salary_amount) return 'Not specified'
    
    const currency = candidate.salary_currency || 'USD'
    const amount = candidate.salary_amount.toLocaleString()
    const period = candidate.salary_period || 'annually'
    
    return `${currency} ${amount} ${period}`
  }

  if (candidatesLoading || jobLoading || profileLoading || organizationsLoading) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <JobAssignmentGuard>
            <AppContainer>
              <div className="space-y-md">
                <Skeleton className="h-[40px] w-[200px]" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                  <div className="lg:col-span-2 space-y-md">
                    <Skeleton className="h-[300px] rounded-brand" />
                  </div>
                  <div className="space-y-md">
                    <Skeleton className="h-[200px] rounded-brand" />
                  </div>
                </div>
              </div>
            </AppContainer>
          </JobAssignmentGuard>
        </PermissionGate>
      </AuthGate>
    )
  }

  if (!candidate) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewCandidates">
          <JobAssignmentGuard>
            <AppContainer>
              <div className="text-center py-xl">
                <h1 className="text-xl font-semibold text-text-primary mb-sm">Candidate not found</h1>
                <p className="text-text-secondary mb-md">The candidate you're looking for doesn't exist or you don't have access to it.</p>
                <Link to={`/jobs/${jobId}?tab=candidates`}>
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-sm" />
                    Back to Candidates
                  </Button>
                </Link>
              </div>
            </AppContainer>
          </JobAssignmentGuard>
        </PermissionGate>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <AppContainer>
            {/* Navigation */}
            <div className="mb-lg flex items-center justify-between">
              <Link to={`/jobs/${jobId}?tab=candidates`}>
                <Button variant="ghost" className="gap-sm h-[44px] text-text-secondary hover:text-text-primary">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Candidates
                </Button>
              </Link>

              {/* Navigation Arrows */}
              <div className="flex items-center gap-sm">
                <Button
                  variant="ghost"
                  className="gap-sm h-[44px] text-text-secondary hover:text-text-primary"
                  onClick={() => previousCandidate && navigateToCandidate(previousCandidate.id)}
                  disabled={!hasPreviousCandidate}
                  title={previousCandidate ? `Previous: ${previousCandidate.candidate_name}` : 'No previous candidate'}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  className="gap-sm h-[44px] text-text-secondary hover:text-text-primary"
                  onClick={() => nextCandidate && navigateToCandidate(nextCandidate.id)}
                  disabled={!hasNextCandidate}
                  title={nextCandidate ? `Next: ${nextCandidate.candidate_name}` : 'No next candidate'}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
              {/* Left Column - Header Card with Tab Bar and Independent Cards */}
              <div className="lg:col-span-2 space-y-md">
                {/* Header Card with Tab Bar */}
                <Card className="!bg-white">
                  <CardContent className="p-layout-md">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h1 className="text-2xl font-semibold text-text-primary mb-2">{candidate.candidate_name}</h1>
                        {job && (
                          <p className="text-text-secondary">
                            Candidate for <span className="font-medium text-text-primary">{job.title}</span>
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-sm">
                        {candidate.linkedin_url ? (
                          <Button 
                            className="gap-sm h-[44px] bg-[#0078c7] text-white hover:bg-[#005a94]"
                            onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                          >
                            <Linkedin className="h-4 w-4" fill="white" />
                            View LinkedIn
                          </Button>
                        ) : (
                          <Button 
                            className="gap-sm h-[44px] bg-[#0078c7] text-white hover:bg-[#005a94]"
                            disabled
                          >
                            <Linkedin className="h-4 w-4" fill="white" />
                            No LinkedIn
                          </Button>
                        )}

                        {independentCandidateId ? (
                          <MoveToPipelineMenu 
                            jobId={jobId!}
                            candidateId={independentCandidateId}
                            buttonText="Move to pipeline"
                          />
                        ) : (
                          <Button size="sm" disabled className="gap-2">
                            Move to pipeline
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-[44px] w-[44px]"
                          onClick={() => generateCandidatePdf({ candidate, job, organization: jobOrganization })}
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Tab Bar inside Header Card */}
                    <div className="w-full bg-surface-primary rounded-xl p-1">
                      <div className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
                        <button 
                          onClick={() => setActiveTab('overview')}
                          className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                            activeTab === 'overview' && "bg-accent text-accent-foreground"
                          )}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Overview
                        </button>
                        <button 
                          onClick={() => setActiveTab('notes')}
                          className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted/50",
                            activeTab === 'notes' && "bg-accent text-accent-foreground"
                          )}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Notes
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Independent Candidate Information Card - Overview Tab */}
                {activeTab === 'overview' && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-text-primary">Candidate Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2xl">
                          <div className="space-y-xl">
                            <div className="flex items-start gap-md text-text-secondary">
                              <MapPin className="h-5 w-5 mt-1 flex-shrink-0" />
                              <div className="space-y-1">
                                <span className="text-sm font-medium block">Location</span>
                                <p className="text-text-primary text-base">{formatLocation(candidate)}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-md text-text-secondary">
                              <DollarSign className="h-5 w-5 mt-1 flex-shrink-0" />
                              <div className="space-y-1">
                                <span className="text-sm font-medium block">Salary Expectations</span>
                                <p className="text-text-primary text-base">{formatSalary(candidate)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-xl">
                            <div className="flex items-start gap-md text-text-secondary">
                              <Calendar className="h-5 w-5 mt-1 flex-shrink-0" />
                              <div className="space-y-1">
                                <span className="text-sm font-medium block">Added</span>
                                <p className="text-text-primary text-base">
                                  {new Date(candidate.created_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-md text-text-secondary">
                              <User className="h-5 w-5 mt-1 flex-shrink-0" />
                              <div className="space-y-1">
                                <span className="text-sm font-medium block">Added By</span>
                                <p className="text-text-primary text-base">Internal Team</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Skills Card - Overview Tab */}
                {activeTab === 'overview' && candidate.skills && candidate.skills.length > 0 && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-text-primary">Skills</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {candidate.skills.map((skill) => (
                          <Badge key={skill} variant={getSkillColor(skill)} className="text-sm">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Independent Profile Summary Card - Overview Tab */}
                {activeTab === 'overview' && candidate.profile_summary && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-text-primary">Profile Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-text-primary">
                        <SafeHtml
                          content={candidate.profile_summary}
                          className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Independent Internal Notes Card - Notes Tab */}
                {activeTab === 'notes' && candidate.notes && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-text-primary">Internal Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none text-text-primary">
                        <SafeHtml
                          content={candidate.notes}
                          className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Independent Comments Card - Notes Tab */}
                {activeTab === 'notes' && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-lg font-medium text-text-primary">Comments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CandidateComments
                        candidateId={candidate.id}
                        jobId={candidate.job_id}
                        organizationId={organizationId || 'default-org'}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - Quick Actions, Job Info, URLs, and Attachments */}
              <div className="space-y-md">
                {/* Quick Actions */}
                <PermissionGate permission="canManageCandidates">
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-text-primary">
                        <Zap className="h-5 w-5" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button onClick={handleEdit} className="w-full gap-sm h-[44px]">
                        <Edit className="h-4 w-4" />
                        Edit Candidate
                      </Button>
                      <Button 
                        onClick={() => setIsOfferLetterDialogOpen(true)} 
                        className="w-full gap-sm h-[44px]"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        Create Offer Letter
                      </Button>
                      <Button 
                        onClick={() => setIsScheduleDialogOpen(true)} 
                        className="w-full gap-sm h-[44px]"
                        variant="outline"
                      >
                        <Clock className="h-4 w-4" />
                        Schedule
                      </Button>
                    </CardContent>
                  </Card>
                </PermissionGate>

                {/* Job Information */}
                {job && (
                  <Card className="bg-surface-primary">
                    <CardHeader>
                      <CardTitle className="text-text-primary">Job Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-sm">
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Position</p>
                        <p className="text-text-primary">{job.title}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Department</p>
                        <p className="text-text-primary">{job.department || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Location</p>
                        <p className="text-text-primary">{job.location || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-secondary">Status</p>
                        <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                          {job.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* URLs */}
                {candidate && (
                  <CandidateUrls candidateId={candidate.id} />
                )}

                {/* Attachments */}
                {candidate && (
                  <CandidateAttachments candidateId={candidate.id} />
                )}
              </div>
            </div>

            {/* Edit Form Modal */}
            {candidate && (
              <CandidateForm
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleFormSubmit}
                candidate={candidate}
                jobId={candidate.job_id}
                isLoading={candidatesLoading}
              />
            )}

            {/* Create Offer Letter Dialog */}
            {candidate && job && jobOrganization && (
              <CreateOfferLetterDialog
                isOpen={isOfferLetterDialogOpen}
                onClose={() => setIsOfferLetterDialogOpen(false)}
                candidate={candidate}
                job={job}
                organization={jobOrganization}
              />
            )}

            {/* Schedule Dialog */}
            <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold text-text-primary">Schedule Meeting</DialogTitle>
                  <DialogDescription className="text-text-secondary">
                    Schedule interviews and meetings with candidates
                  </DialogDescription>
                </DialogHeader>
                <div className="py-6 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium text-text-primary mb-2">Coming Soon</h3>
                  <p className="text-text-secondary">
                    Scheduling functionality will be available in an upcoming update.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </AppContainer>
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
