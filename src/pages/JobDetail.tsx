
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Archive, DollarSign, MapPin, Building, Users, Calendar, UserCheck, Briefcase } from 'lucide-react'
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
        await loadJob()
      } catch (error) {
        console.error('Failed to archive job:', error)
      }
    }
  }

  const handleFormSubmit = async (data: any) => {
    if (!job) return
    await updateJob(job.id, data)
    await loadJob()
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
            <div className="container mx-auto py-lg px-md">
              <div className="flex items-center justify-center py-xl">
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
          <div className="container mx-auto py-lg px-md max-w-7xl">
            {/* Header Section */}
            <div className="mb-lg">
              <Button variant="ghost" onClick={() => navigate('/jobs')} className="mb-md min-h-[44px] gap-sm">
                <ArrowLeft className="h-5 w-5" />
                Back to Jobs
              </Button>
              
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-md">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-md mb-sm">
                    <h1 className="heading-lg font-poppins font-semibold text-primary truncate">{job.title}</h1>
                    <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                      {job.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-md text-secondary">
                    <div className="flex items-center gap-xs">
                      <Building className="h-4 w-4" />
                      <span className="text-md">{job.organization_name || 'Organization'}</span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-xs">
                      <Briefcase className="h-4 w-4" />
                      <span className="text-md">{job.level}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-sm shrink-0">
                  {permissions.canEditJobs && (
                    <Button variant="outline" onClick={handleEdit} className="min-h-[44px] gap-sm">
                      <Edit className="h-5 w-5" />
                      Edit Job
                    </Button>
                  )}
                  
                  {permissions.canArchiveJobs && job.status !== 'archived' && (
                    <Button variant="outline" onClick={handleArchive} className="min-h-[44px] gap-sm">
                      <Archive className="h-5 w-5" />
                      Archive
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
              {/* Left Column - Job Information */}
              <div className="lg:col-span-2 space-y-lg">
                {/* Job Description */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-sm">
                      <Briefcase className="h-5 w-5 text-accent" />
                      Job Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {job.description ? (
                      <div className="whitespace-pre-wrap text-md leading-relaxed text-primary">
                        {job.description}
                      </div>
                    ) : (
                      <p className="text-secondary">No description provided</p>
                    )}
                  </CardContent>
                </Card>

                {/* Job Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-sm">
                      <Building className="h-5 w-5 text-accent" />
                      Position Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
                      <div className="flex items-start gap-sm">
                        <Building className="h-5 w-5 text-secondary mt-xs shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary mb-xs">Department</p>
                          <p className="text-md text-primary break-words">
                            {job.department || 'Not specified'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-sm">
                        <MapPin className="h-5 w-5 text-secondary mt-xs shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary mb-xs">Location</p>
                          <p className="text-md text-primary break-words">
                            {job.location || 'Not specified'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-sm">
                        <DollarSign className="h-5 w-5 text-secondary mt-xs shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary mb-xs">Salary Range</p>
                          <p className="text-md text-primary break-words">
                            {formatSalary(job.salary_min, job.salary_max, job.currency)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-sm">
                        <Users className="h-5 w-5 text-secondary mt-xs shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-secondary mb-xs">Hiring Team</p>
                          <p className="text-md text-primary">
                            {job.hiring_team && job.hiring_team.length > 0
                              ? `${job.hiring_team.length} member(s)`
                              : 'No team assigned'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Candidates Section - Mobile Only */}
                <div className="lg:hidden">
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
              </div>

              {/* Right Column - Candidates & Metadata */}
              <div className="space-y-lg">
                {/* Candidates Section - Desktop Only */}
                <div className="hidden lg:block">
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

                {/* Metadata Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-sm">
                      <Calendar className="h-5 w-5 text-accent" />
                      Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-md">
                    <div className="flex items-start gap-sm">
                      <Calendar className="h-5 w-5 text-secondary mt-xs shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-secondary mb-xs">Created</p>
                        <p className="text-md text-primary">
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-sm">
                      <UserCheck className="h-5 w-5 text-secondary mt-xs shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-secondary mb-xs">Last Updated</p>
                        <p className="text-md text-primary">
                          {new Date(job.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Forms */}
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
