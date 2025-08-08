import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useJobs } from '@/hooks/useJobs'
import { JobDetailFloatingSidebar } from '@/components/jobs/JobDetailFloatingSidebar'
import { JobDetailMobileHeader } from '@/components/jobs/JobDetailMobileHeader'

import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import { JobAssignmentsPanel } from '@/components/jobs/JobAssignmentsPanel'
import { JobSetupPanel } from '@/components/jobs/JobSetupPanel'
import { JobForm } from '@/components/jobs/JobForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Archive } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { SalaryInsightsCard } from '@/components/jobs/SalaryInsightsCard'
import { PipelineOverview } from '@/components/jobs/PipelineOverview'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userType } = useAuth()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('job-setup')
  const [showEditJobModal, setShowEditJobModal] = useState(false)

  // Jobs hook for updating
  const { updateJob, isLoading: jobUpdateLoading } = useJobs()

  // Job assignments hook
  const {
    assignments,
    assignUserToJob,
    removeUserFromJob,
    isLoading: assignmentsLoading
  } = useJobAssignments(id!)

  // Candidates hook with new functions
  const {
    candidates,
    isLoading: candidatesLoading,
    addCandidate,
    updateCandidate,
    deleteCandidate,
    markCandidateAsViewed,
    isCandidateNewForUser
  } = useCandidates(id!)

  // In-pipeline associations for filtering Application Review
  const [inPipelineKeys, setInPipelineKeys] = useState<Set<string>>(new Set())
  const [pipelineLoading, setPipelineLoading] = useState(false)

  const normalizeUrl = (url?: string | null) => url?.trim().replace(/\/+$/, '').toLowerCase() || ''
  const makeNameLocKey = (
    name?: string | null,
    city?: string | null,
    country?: string | null
  ) => `${(name || '').trim().toLowerCase()}||${(city || '').trim().toLowerCase()}||${(country || '').trim().toLowerCase()}`

  useEffect(() => {
    if (!id || !user) return
    const load = async () => {
      setPipelineLoading(true)
      try {
        const { data, error } = await supabase
          .from('job_candidate_associations')
          .select(`id, current_stage_id, candidate:candidates(id, candidate_name, linkedin_url, location_city, location_country)`)
          .eq('job_id', id)
          .not('current_stage_id', 'is', null)
        if (error) throw error
        const keys = new Set<string>()
        ;(data || []).forEach((row: any) => {
          const c = (row as any).candidate || {}
          const link = normalizeUrl(c.linkedin_url)
          if (link) keys.add('link:' + link)
          if (c.candidate_name) {
            keys.add('name:' + makeNameLocKey(c.candidate_name, c.location_city, c.location_country))
          }
        })
        setInPipelineKeys(keys)
      } catch (e) {
        console.error('Failed to load pipeline associations', e)
      } finally {
        setPipelineLoading(false)
      }
    }
    load()
  }, [id, user])

  const applicationReviewCandidates = useMemo(() => {
    if (!candidates?.length) return candidates
    return candidates.filter((c: any) => {
      const link = normalizeUrl(c.linkedin_url)
      if (link && inPipelineKeys.has('link:' + link)) return false
      const key = 'name:' + makeNameLocKey(c.candidate_name, c.location_city, c.location_country)
      return !inPipelineKeys.has(key)
    })
  }, [candidates, inPipelineKeys])

  // Job query with improved error handling for assigned recruiters
  const { data: job, isLoading: jobLoading, error, refetch } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      if (!id) throw new Error('No job ID provided')
      
      console.log('Fetching job details for ID:', id)
      
      // Try the main query first with left join to prevent failures
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          organization:organizations(
            id,
            name,
            country
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Error fetching job with organization:', error)
        
        // If the main query fails, try to fetch just the job data
        // This handles cases where recruiters are assigned to jobs from organizations they can't access
        console.log('Attempting fallback query for job data only')
        const { data: jobOnly, error: jobOnlyError } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', id)
          .single()

        if (jobOnlyError) {
          console.error('Fallback job query also failed:', jobOnlyError)
          throw jobOnlyError
        }

        console.log('Fallback job query succeeded:', jobOnly)
        
        // If we can access the job but not the organization, return job with unknown organization
        return {
          ...jobOnly,
          hiring_team_names: [], // Add missing property
          organization: {
            id: jobOnly.organization_id,
            name: 'Organization',
            country: 'Unknown'
          }
        }
      }

      console.log('Fetched job with organization:', data)
      return {
        ...data,
        hiring_team_names: [] // Add missing property
      }
    },
    enabled: !!id && !!user,
  })

  const handleBackToJobs = () => {
    navigate('/jobs')
  }

  const handleEditJob = () => {
    setShowEditJobModal(true)
  }

  const handleJobFormSubmit = async (jobData: any) => {
    if (!id) return
    
    try {
      await updateJob(id, jobData)
      setShowEditJobModal(false)
      // Refetch job data to show updated information
      refetch()
    } catch (error) {
      console.error('Error updating job:', error)
    }
  }

  const handleArchiveJob = async () => {
    if (!id || !confirm('Are you sure you want to archive this job?')) return

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'archived' })
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Job archived successfully'
      })

      navigate('/jobs')
    } catch (error) {
      console.error('Error archiving job:', error)
      toast({
        title: 'Error',
        description: 'Failed to archive job',
        variant: 'destructive'
      })
    }
  }

  const handleAddCandidate = async (candidateData: any) => {
    try {
      await addCandidate(candidateData)
      setShowAddCandidate(false)
    } catch (error) {
      console.error('Error adding candidate:', error)
    }
  }

  const handleEditCandidate = (candidate: any) => {
    setEditingCandidate(candidate)
  }

  const handleUpdateCandidate = async (candidateData: any) => {
    if (!editingCandidate) return
    
    try {
      await updateCandidate(editingCandidate.id, candidateData)
      setEditingCandidate(null)
    } catch (error) {
      console.error('Error updating candidate:', error)
    }
  }

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      await deleteCandidate(candidateId)
    } catch (error) {
      console.error('Error deleting candidate:', error)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="py-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-red-600 mb-4">Job Not Found</h2>
                <p className="text-muted-foreground mb-4">
                  The job you're looking for doesn't exist or you don't have permission to view it.
                </p>
                <Button onClick={handleBackToJobs}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Jobs
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (jobLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6">
            {!isMobile && (
              <div className="w-64">
                <Skeleton className="h-40 w-full" />
              </div>
            )}
            <div className="flex-1">
              <div className="space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!job) return null

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
        {/* Mobile Header */}
        {isMobile && (
          <div className="mb-6">
            <JobDetailMobileHeader
              jobTitle={job.title}
              onMenuToggle={() => {}}
              onBackToJobs={handleBackToJobs}
            />
          </div>
        )}

        {/* Desktop Header with Back and Archive buttons - separate from content */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={handleBackToJobs} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Button>
            {permissions.canEditJobs && job.status !== 'archived' && (
              <Button variant="outline" onClick={handleArchiveJob} className="gap-2">
                <Archive className="h-4 w-4" />
                Archive Job
              </Button>
            )}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            // Mobile: Tabs
            <>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="candidates">Application Review</TabsTrigger>
                  <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                  <TabsTrigger value="job-setup">Setup</TabsTrigger>
                </TabsList>
              
              
              <TabsContent value="candidates">
                <div className="space-y-6">
                  <SalaryInsightsCard 
                    candidates={applicationReviewCandidates}
                    jobCurrency={job.currency || 'USD'}
                  />
                  <CandidateTable
                    candidates={applicationReviewCandidates}
                    isLoading={candidatesLoading}
                    onEdit={handleEditCandidate}
                    onDelete={handleDeleteCandidate}
                    onAddNew={() => setShowAddCandidate(true)}
                    markCandidateAsViewed={markCandidateAsViewed}
                    isCandidateNewForUser={isCandidateNewForUser}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="job-setup">
                <JobSetupPanel
                  jobId={id!}
                  jobTitle={job.title}
                  job={{
                    ...job,
                    hiring_team: (job.hiring_team as any[]) || []
                  }}
                  onEdit={handleEditJob}
                />
              </TabsContent>
              <TabsContent value="pipeline">
                <div className="h-[calc(100svh-16rem)] sm:h-[calc(100svh-14rem)] min-h-0">
                  <Card className="h-full w-full overflow-hidden flex flex-col">
                    <CardHeader className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/60 border-b border-border">
                      <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
                      <p className="text-sm text-text-secondary">Drag candidates across stages. Scroll horizontally to view more columns.</p>
                    </CardHeader>
                    <CardContent className="p-0 h-0 flex-1">
                      <ScrollArea className="h-full w-full">
                        <div className="w-fit p-layout-md">
                          <PipelineOverview jobId={id!} showHeader={false} />
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </>
          ) : (
            // Desktop: Floating sidebar at same level as content
            <div className="flex gap-6 min-h-0 min-w-0">
              <JobDetailFloatingSidebar
                currentTab={activeTab}
                onTabChange={setActiveTab}
                jobTitle={job.title}
              />
              
              {/* Main content */}
              <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                <TabsContent value="candidates">
                  <div className="space-y-6">
                    <SalaryInsightsCard 
                      candidates={applicationReviewCandidates}
                      jobCurrency={job.currency || 'USD'}
                    />
                    <CandidateTable
                      candidates={applicationReviewCandidates}
                      isLoading={candidatesLoading}
                      onEdit={handleEditCandidate}
                      onDelete={handleDeleteCandidate}
                      onAddNew={() => setShowAddCandidate(true)}
                      markCandidateAsViewed={markCandidateAsViewed}
                      isCandidateNewForUser={isCandidateNewForUser}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="job-setup">
                  <JobSetupPanel
                    jobId={id!}
                    jobTitle={job.title}
                    job={{
                      ...job,
                      hiring_team: (job.hiring_team as any[]) || []
                    }}
                    onEdit={handleEditJob}
                  />
                </TabsContent>
                <TabsContent value="pipeline">
                  <div className="h-[calc(100svh-14rem)] min-h-0">
                    <Card className="h-full w-full overflow-hidden flex flex-col">
                      <CardHeader className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/60 border-b border-border">
                        <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
                        <p className="text-sm text-text-secondary">Drag candidates across stages. Scroll horizontally to view more columns.</p>
                      </CardHeader>
                      <CardContent className="p-0 h-0 flex-1">
                        <ScrollArea className="h-full w-full">
                          <div className="w-fit p-layout-md">
                            <PipelineOverview jobId={id!} showHeader={false} />
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </div>
            </div>
          )}
        </Tabs>

        {/* Edit Job Modal */}
        <JobForm
          isOpen={showEditJobModal}
          onClose={() => setShowEditJobModal(false)}
          onSubmit={handleJobFormSubmit}
          job={job ? {
            ...job,
            hiring_team: Array.isArray(job.hiring_team) ? job.hiring_team : []
          } : null}
          isLoading={jobUpdateLoading}
        />

        {/* Add Candidate Dialog */}
        <Dialog open={showAddCandidate} onOpenChange={setShowAddCandidate}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Candidate</DialogTitle>
            </DialogHeader>
            <CandidateForm
              isOpen={showAddCandidate}
              onClose={() => setShowAddCandidate(false)}
              onSubmit={handleAddCandidate}
              jobId={id!}
              isLoading={candidatesLoading}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Candidate Dialog */}
        <Dialog open={!!editingCandidate} onOpenChange={() => setEditingCandidate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Candidate</DialogTitle>
            </DialogHeader>
            <CandidateForm
              isOpen={!!editingCandidate}
              onClose={() => setEditingCandidate(null)}
              onSubmit={handleUpdateCandidate}
              candidate={editingCandidate}
              jobId={id!}
              isLoading={candidatesLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
