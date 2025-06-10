import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Archive, DollarSign, MapPin, Building, Users } from 'lucide-react'
import { AuthGate } from '@/components/auth/AuthGate'
import { PermissionGate } from '@/components/auth/PermissionGate'
import { useJobs, Job } from '@/hooks/useJobs'
import { usePermissions } from '@/hooks/usePermissions'
import { JobForm } from '@/components/jobs/JobForm'
import { useCandidates } from '@/hooks/useCandidates'
import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import type { Candidate } from '@/hooks/useCandidates'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isCandidateFormOpen, setIsCandidateFormOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const { getJob, updateJob, archiveJob, isLoading } = useJobs()
  const { 
    candidates, 
    isLoading: candidatesLoading, 
    addCandidate, 
    updateCandidate, 
    deleteCandidate 
  } = useCandidates(id)
  const permissions = usePermissions()

  useEffect(() => {
    if (id) {
      loadJob()
    }
  }, [id])

  const loadJob = async () => {
    if (!id) return
    
    try {
      const jobData = await getJob(id)
      setJob(jobData)
    } catch (error) {
      console.error('Failed to load job:', error)
      navigate('/jobs')
    }
  }

  const handleEdit = () => {
    setIsFormOpen(true)
  }

  const handleArchive = async () => {
    if (!job) return
    
    if (confirm('Are you sure you want to archive this job?')) {
      try {
        await archiveJob(job.id)
        await loadJob() // Refresh job data
      } catch (error) {
        console.error('Failed to archive job:', error)
      }
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (!job) return
    await updateJob(job.id, data)
    await loadJob() // Refresh job data
  }

  const handleAddCandidate = () => {
    setSelectedCandidate(null)
    setIsCandidateFormOpen(true)
  }

  const handleEditCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate)
    setIsCandidateFormOpen(true)
  }

  const handleCandidateFormSubmit = async (data: any) => {
    if (selectedCandidate) {
      await updateCandidate(selectedCandidate.id, data)
    } else {
      await addCandidate(data)
    }
    setIsCandidateFormOpen(false)
    setSelectedCandidate(null)
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    await deleteCandidate(candidateId)
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'default'
      case 'draft':
        return 'secondary'
      case 'closed':
        return 'destructive'
      case 'archived':
        return 'outline'
      default:
        return 'secondary'
    }
  }

  const formatSalary = (min: number | null, max: number | null, currency: string | null) => {
    if (!min && !max) return 'Not specified'
    
    const curr = currency || 'USD'
    if (min && max) {
      return `${curr} ${min.toLocaleString()} - ${max.toLocaleString()}`
    }
    if (min) {
      return `${curr} ${min.toLocaleString()}+`
    }
    if (max) {
      return `Up to ${curr} ${max.toLocaleString()}`
    }
    return 'Not specified'
  }

  if (isLoading || !job) {
    return (
      <AuthGate>
        <PermissionGate permission="canViewJobs">
          <div className="min-h-screen bg-background">
            <div className="container mx-auto py-token-xl px-token-lg">
              <div className="flex items-center justify-center py-token-xl">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
              </div>
            </div>
          </div>
        </PermissionGate>
      </AuthGate>
    )
  }

  return (
    <AuthGate>
      <PermissionGate permission="canViewJobs">
        <div className="min-h-screen bg-background">
          <div className="container mx-auto py-token-xl px-token-lg">
            <div className="mb-token-xl">
              <Button variant="ghost" onClick={() => navigate('/jobs')} className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Jobs
              </Button>
              
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
                  <p className="text-muted-foreground mt-token-sm">
                    {job.organization_name} • {job.level}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge variant={getStatusBadgeVariant(job.status)}>
                    {job.status}
                  </Badge>
                  
                  {permissions.canEditJobs && (
                    <Button variant="outline" onClick={handleEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  
                  {permissions.canArchiveJobs && job.status !== 'archived' && (
                    <Button variant="outline" onClick={handleArchive}>
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Job Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {job.description ? (
                      <div className="whitespace-pre-wrap text-sm">
                        {job.description}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No description provided</p>
                    )}
                  </CardContent>
                </Card>

                {/* Candidates Section */}
                <PermissionGate permission="canViewCandidates">
                  <CandidateTable
                    candidates={candidates}
                    isLoading={candidatesLoading}
                    onEdit={handleEditCandidate}
                    onDelete={handleDeleteCandidate}
                    onAddNew={handleAddCandidate}
                  />
                </PermissionGate>
              </div>

              <div className="space-y-6">
                
                <Card>
                  <CardHeader>
                    <CardTitle>Job Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Department</p>
                        <p className="text-sm text-muted-foreground">
                          {job.department || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Location</p>
                        <p className="text-sm text-muted-foreground">
                          {job.location || 'Not specified'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-3">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Salary Range</p>
                        <p className="text-sm text-muted-foreground">
                          {formatSalary(job.salary_min, job.salary_max, job.currency)}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Hiring Team</p>
                        <p className="text-sm text-muted-foreground">
                          {job.hiring_team && job.hiring_team.length > 0
                            ? `${job.hiring_team.length} member(s)`
                            : 'No team assigned'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(job.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <JobForm
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onSubmit={handleFormSubmit}
              job={job}
              isLoading={isLoading}
            />

            {job && (
              <CandidateForm
                isOpen={isCandidateFormOpen}
                onClose={() => {
                  setIsCandidateFormOpen(false)
                  setSelectedCandidate(null)
                }}
                onSubmit={handleCandidateFormSubmit}
                candidate={selectedCandidate}
                jobId={job.id}
                isLoading={candidatesLoading}
              />
            )}
          </div>
        </div>
      </PermissionGate>
    </AuthGate>
  )
}
