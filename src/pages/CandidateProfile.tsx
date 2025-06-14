
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, MapPin, DollarSign, Calendar, User, Edit } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { JobAssignmentGuard } from '@/components/auth/JobAssignmentGuard'
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
            <div className="min-h-screen bg-background">
              <div className="container mx-auto py-lg px-md max-w-6xl">
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
              </div>
            </div>
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
            <div className="min-h-screen bg-background">
              <div className="container mx-auto py-lg px-md max-w-6xl">
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
              </div>
            </div>
          </JobAssignmentGuard>
        </PermissionGate>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewCandidates">
        <JobAssignmentGuard>
          <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b border-border bg-surface-primary">
              <div className="container mx-auto py-md px-md max-w-6xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <Link to={`/jobs/${jobId}?tab=candidates`}>
                      <Button variant="ghost" className="gap-sm h-[44px]">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Candidates
                      </Button>
                    </Link>
                    <div>
                      <h1 className="text-xl font-semibold text-text-primary">{candidate.candidate_name}</h1>
                      {job && (
                        <p className="text-sm text-text-secondary">
                          Candidate for <span className="font-medium">{job.title}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <PermissionGate permission="canManageCandidates">
                    <Button onClick={handleEdit} className="gap-sm h-[44px]">
                      <Edit className="h-4 w-4" />
                      Edit Candidate
                    </Button>
                  </PermissionGate>
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto py-lg px-md max-w-6xl">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
                {/* Left Column - Main Info */}
                <div className="lg:col-span-2 space-y-md">
                  <Card className="bg-surface-primary border-border">
                    <CardHeader>
                      <CardTitle className="text-text-primary">Candidate Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-md">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
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

                  {/* Profile Summary */}
                  {candidate.profile_summary && (
                    <Card className="bg-surface-primary border-border">
                      <CardHeader>
                        <CardTitle className="text-text-primary">Profile Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none text-text-primary">
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {candidate.profile_summary}
                          </p>
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
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {candidate.notes}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column - Comments & Job Info */}
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
          </div>
        </JobAssignmentGuard>
      </PermissionGate>
    </AuthGate>
  )
}
