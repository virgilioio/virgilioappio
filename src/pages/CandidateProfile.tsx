
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit, Zap, Linkedin } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
import { AppContainer } from '@/components/layout/AppContainer'
import { useCandidates, Candidate } from '@/hooks/useCandidates'
import { useJobs } from '@/hooks/useJobs'
import { useAuth } from '@/contexts/AuthContext'
import { CandidateComments } from '@/components/candidates/CandidateComments'
import { CandidateForm } from '@/components/candidates/CandidateForm'

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
              {/* Left Column - Header Card, Profile Summary and Notes */}
              <div className="lg:col-span-2 space-y-md">
                {/* Header Card */}
                <Card className="bg-surface-primary border-border">
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
                      
                      <Button 
                        className="gap-sm h-[44px] bg-[#0078c7] text-white hover:bg-[#005a94]"
                      >
                        <Linkedin className="h-4 w-4" fill="white" />
                        LinkedIn Account
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Profile Summary */}
                {candidate.profile_summary && (
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle className="text-text-primary">Profile Summary</CardTitle>
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

                {/* Notes */}
                {candidate.notes && (
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle className="text-text-primary">Internal Notes</CardTitle>
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
              </div>

              {/* Right Column - Quick Actions, Job Info, Candidate Info & Comments */}
              <div className="space-y-md">
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

                {/* Candidate Information */}
                <Card className="bg-surface-primary border-border">
                  <CardHeader>
                    <CardTitle className="text-text-primary">Candidate Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-md">
                    <div className="grid grid-cols-1 gap-md">
                      <div className="space-y-sm">
                        <div className="flex items-center gap-sm text-text-secondary">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm font-medium">Location</span>
                        </div>
                        <p className="text-text-primary ml-6">{formatLocation(candidate)}</p>
                      </div>

                      <div className="space-y-sm">
                        <div className="flex items-center gap-sm text-text-secondary">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-sm font-medium">Salary Expectations</span>
                        </div>
                        <p className="text-text-primary ml-6">{formatSalary(candidate)}</p>
                      </div>

                      <div className="space-y-sm">
                        <div className="flex items-center gap-sm text-text-secondary">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm font-medium">Added</span>
                        </div>
                        <p className="text-text-primary ml-6">
                          {new Date(candidate.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>

                      <div className="space-y-sm">
                        <div className="flex items-center gap-sm text-text-secondary">
                          <User className="h-4 w-4" />
                          <span className="text-sm font-medium">Added By</span>
                        </div>
                        <p className="text-text-primary ml-6">Internal Team</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Comments Section */}
                <Card className="bg-surface-primary border-border">
                  <CardHeader>
                    <CardTitle className="text-text-primary">Comments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CandidateComments
                      candidateId={candidate.id}
                      jobId={candidate.job_id}
                      organizationId={user?.user_metadata?.organization_id || 'default-org'}
                    />
                  </CardContent>
                </Card>
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
