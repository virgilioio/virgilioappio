import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit, Zap, Linkedin, FileText, MessageSquare } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { AppContainer } from '@/components/layout/AppContainer'
import { useCandidates, Candidate } from '@/hooks/useCandidates'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { cn } from '@/lib/utils'
import { CandidateAttachments } from '@/components/candidates/CandidateAttachments'
import { CandidateUrls } from '@/components/candidates/CandidateUrls'

export default function CandidateProfile() {
  const { jobId, candidateId } = useParams<{ jobId: string; candidateId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState<Candidate | null>(null)
  const [job, setJob] = useState<any>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const { candidates, isLoading: candidatesLoading, updateCandidate } = useCandidates(jobId || '')
  const { getJob, isLoading: jobLoading } = useJobs()

  useEffect(() => {
    if (jobId && candidateId && candidates.length > 0) {
      const foundCandidate = candidates.find(c => c.id === candidateId)
      setCandidate(foundCandidate || null)
    }
  }, [candidates, candidateId])

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

  const handleEdit = () => {
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (data: any) => {
    if (!candidate) return
    await updateCandidate(candidate.id, data)
    setIsFormOpen(false)
    // Refresh candidate data
    const updatedCandidate = candidates.find(c => c.id === candidateId)
    setCandidate(updatedCandidate || null)
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

  if (candidatesLoading || jobLoading) {
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
            <div className="mb-lg">
              <Link to={`/jobs/${jobId}?tab=candidates`}>
                <Button variant="ghost" className="gap-sm h-[44px] text-text-secondary hover:text-text-primary">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Candidates
                </Button>
              </Link>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
              {/* Left Column - Header Card and Tabbed Content */}
              <div className="lg:col-span-2 space-y-md">
                {/* Header Card */}
                <Card className={cn("border-border", "!bg-white")}>
                  <CardContent className="p-layout-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h1 className="text-2xl font-semibold text-text-primary mb-2">{candidate.candidate_name}</h1>
                        {job && (
                          <p className="text-text-secondary">
                            Candidate for <span className="font-medium text-text-primary">{job.title}</span>
                          </p>
                        )}
                      </div>
                      
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
                    </div>
                  </CardContent>
                </Card>

                {/* Independent Tab Bar */}
                <div className="w-full bg-surface-primary rounded-xl p-1 border border-border shadow-sm">
                  <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="inline-flex h-auto items-center justify-start rounded-xl bg-transparent p-0 text-muted-foreground w-full">
                      <TabsTrigger 
                        value="overview" 
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm hover:bg-muted/50"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Overview
                      </TabsTrigger>
                      <TabsTrigger 
                        value="notes"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-sm hover:bg-muted/50"
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Notes
                      </TabsTrigger>
                    </TabsList>

                    {/* Tabbed Content */}
                    <TabsContent value="overview" className="space-y-md mt-md">
                      {/* Candidate Information Card */}
                      <Card className="bg-surface-primary border-border">
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

                      {/* Profile Summary Card */}
                      {candidate.profile_summary && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg font-medium text-text-primary">Profile Summary</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none text-text-primary">
                              <div 
                                className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: candidate.profile_summary }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-md mt-md">
                      {/* Internal Notes Card */}
                      {candidate.notes && (
                        <Card className="bg-surface-primary border-border">
                          <CardHeader>
                            <CardTitle className="text-lg font-medium text-text-primary">Internal Notes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="prose prose-sm max-w-none text-text-primary">
                              <div 
                                className="leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: candidate.notes }}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Comments Card */}
                      <Card className="bg-surface-primary border-border">
                        <CardHeader>
                          <CardTitle className="text-lg font-medium text-text-primary">Comments</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <CandidateComments
                            candidateId={candidate.id}
                            jobId={candidate.job_id}
                            organizationId={user?.user_metadata?.organization_id || 'default-org'}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>

              {/* Right Column - Job Info, URLs, Attachments, and Quick Actions */}
              <div className="space-y-md">
                {/* Job Information */}
                {job && (
                  <Card className="bg-surface-primary border-border">
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

                {/* Quick Actions */}
                <PermissionGate permission="canManageCandidates">
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-text-primary">
                        <Zap className="h-5 w-5" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleEdit} className="w-full gap-sm h-[44px]">
                        <Edit className="h-4 w-4" />
                        Edit Candidate
                      </Button>
                    </CardContent>
                  </Card>
                </PermissionGate>
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
          </AppContainer>
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
