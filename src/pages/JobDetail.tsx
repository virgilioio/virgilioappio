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
import { PageHeader } from '@/components/layout/PageHeader'

import { CandidateTable } from '@/components/candidates/CandidateTable'
import { CandidateForm } from '@/components/candidates/CandidateForm'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { JobAssignmentsPanel } from '@/components/jobs/JobAssignmentsPanel'
import { JobSetupPanel } from '@/components/jobs/JobSetupPanel'
import { JobForm } from '@/components/jobs/JobForm'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Archive, LayoutGrid, List, UserPlus } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { SalaryInsightsCard } from '@/components/jobs/SalaryInsightsCard'
import { PipelineOverview } from '@/components/jobs/PipelineOverview'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePipelineActions, PipelineAssociation } from '@/hooks/usePipelineActions'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import BulkMoveJobCandidatesToPipelineDialog from '@/components/candidates/BulkMoveJobCandidatesToPipelineDialog'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, userType } = useAuth()
  const permissions = usePermissions()
  const isMobile = useIsMobile()
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('pipeline')
  const [showEditJobModal, setShowEditJobModal] = useState(false)
  const [pipelineView, setPipelineView] = useState<'board' | 'list'>(() => {
    if (typeof window === 'undefined') return 'board'
    const saved = localStorage.getItem('jobPipelineView')
    return saved === 'list' ? 'list' : 'board'
  })
  useEffect(() => {
    try { localStorage.setItem('jobPipelineView', pipelineView) } catch {}
  }, [pipelineView])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [tableSelectionMode, setTableSelectionMode] = useState(false)
  const [pipelineRefresh, setPipelineRefresh] = useState(0)

  // In-place profile sheet state with navigation
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileCandidateId, setProfileCandidateId] = useState<string | null>(null)
  const [profileContext, setProfileContext] = useState<'application' | 'pipeline' | null>(null)
  const [profileCandidateList, setProfileCandidateList] = useState<any[]>([])
  const [profileCurrentIndex, setProfileCurrentIndex] = useState(0)
  
  const openProfileInPlace = (candidateId: string, context: 'application' | 'pipeline' = 'application', candidateList: any[] = []) => {
    const index = candidateList.findIndex((c: any) => c.id === candidateId)
    setProfileCandidateId(candidateId)
    setProfileContext(context)
    setProfileCandidateList(candidateList)
    setProfileCurrentIndex(index >= 0 ? index : 0)
    setProfileOpen(true)
  }

  // Navigation functions for profile sheet
  const handleNavigatePrev = () => {
    if (profileCurrentIndex > 0) {
      const newIndex = profileCurrentIndex - 1
      const newCandidateId = profileCandidateList[newIndex]?.id
      if (newCandidateId) {
        setProfileCurrentIndex(newIndex)
        setProfileCandidateId(newCandidateId)
      }
    }
  }

  const handleNavigateNext = () => {
    if (profileCurrentIndex < profileCandidateList.length - 1) {
      const newIndex = profileCurrentIndex + 1
      const newCandidateId = profileCandidateList[newIndex]?.id
      if (newCandidateId) {
        setProfileCurrentIndex(newIndex)
        setProfileCandidateId(newCandidateId)
      }
    }
  }

  const hasPrev = profileCurrentIndex > 0
  const hasNext = profileCurrentIndex < profileCandidateList.length - 1

  // Create wrapper functions for different candidate contexts
  const openApplicationProfile = (candidateId: string) => openProfileInPlace(candidateId, 'application', applicationReviewCandidates)
  const openOffersProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', offersCandidates)
  const openHiredProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', hiredCandidates)
  const openRejectedProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', rejectedCandidates)

  // Inner tabs for Pipeline section
  const [pipelineSectionTab, setPipelineSectionTab] = useState<'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'>('recruiting')

  // Assocations and status-based lists
  const { fetchAssociationsForJob, updateAssociationStatus } = usePipelineActions()
  const [associations, setAssociations] = useState<PipelineAssociation[]>([])
  const [stageMap, setStageMap] = useState<Record<string, { type: string; name: string }>>({})
  const [offersCandidates, setOffersCandidates] = useState<any[]>([])
  const [hiredCandidates, setHiredCandidates] = useState<any[]>([])
  const [rejectedCandidates, setRejectedCandidates] = useState<any[]>([])
  const [allAssociatedCandidates, setAllAssociatedCandidates] = useState<any[]>([])
  const [statusListsLoading, setStatusListsLoading] = useState(false)

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

  // Open in-place sheet for Application Review rows (job_candidates)
  const handleApplicationRowClick = async (jobCandidateId: string) => {
    const jc = (applicationReviewCandidates as any[])?.find((c) => c.id === jobCandidateId)
    if (!jc) return

    const norm = normalizeUrl(jc.linkedin_url)
    // Try association match by linkedin
    let assoc = associations.find((a) => norm && normalizeUrl(a.linkedin_url || '') === norm)
    // Fallback: match by name (best-effort)
    if (!assoc) {
      const jcName = (jc.candidate_name || '').trim().toLowerCase()
      assoc = associations.find((a) => (a.candidate_name || '').trim().toLowerCase() === jcName)
    }

    if (assoc?.candidate_id) {
      openProfileInPlace(assoc.candidate_id, 'application', applicationReviewCandidates)
      return
    }

    // Final fallback: try to find independent candidate by linkedin or by name+location
    try {
      let candId: string | null = null
      if (norm) {
        const { data } = await supabase.from('candidates').select('id').eq('linkedin_url', jc.linkedin_url).maybeSingle()
        candId = data?.id ?? null
      }
      if (!candId) {
        let q = supabase
          .from('candidates')
          .select('id')
          .eq('candidate_name', jc.candidate_name)
        if (jc.location_country === null || jc.location_country === undefined) {
          q = q.is('location_country', null)
        } else {
          q = q.eq('location_country', jc.location_country)
        }
        if (jc.location_city === null || jc.location_city === undefined) {
          q = q.is('location_city', null)
        } else {
          q = q.eq('location_city', jc.location_city)
        }
        const { data } = await q.maybeSingle()
        candId = data?.id ?? null
      }
      if (candId) {
        openProfileInPlace(candId, 'application', applicationReviewCandidates)
      } else {
        toast({ title: 'Not found', description: 'Could not locate profile for this candidate yet.', variant: 'destructive' })
      }
    } catch (e) {
      console.error('Error resolving profile candidate id', e)
      toast({ title: 'Error', description: 'Could not open candidate profile.', variant: 'destructive' })
    }
  }

  // Derived job stats
  const offerCount = useMemo(() => associations.filter(a => a.status !== 'rejected' && (a.status === 'offer' || (a.current_stage_id && stageMap[a.current_stage_id!]?.type === 'offer'))).length, [associations, stageMap])
  const hiredCount = useMemo(() => associations.filter(a => a.status === 'hired').length, [associations])
  const rejectedCount = useMemo(() => associations.filter(a => a.status === 'rejected').length, [associations])
  const activeCount = useMemo(() => associations.filter(a => a.status !== 'rejected').length, [associations])
  const recruitingCount = useMemo(() => Math.max(0, activeCount - offerCount), [activeCount, offerCount])
  const applicationCount = useMemo(() => (applicationReviewCandidates?.length ?? 0), [applicationReviewCandidates])
  // Load stage map for this job
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('id, stage:job_stages(stage_type, stage_name)')
        .eq('job_id', id)
      if (!error && data) {
        const m: Record<string, { type: string; name: string }> = {}
        ;(data as any[]).forEach((row: any) => {
          m[row.id] = { type: row.stage?.stage_type, name: row.stage?.stage_name }
        })
        setStageMap(m)
      }
    }
    load()
  }, [id])

  // Load associations for status tabs
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const list = await fetchAssociationsForJob(id)
      setAssociations(list)
    }
    load()
  }, [id, fetchAssociationsForJob, pipelineRefresh])

  // Load candidate details for offers/hired/rejected and all associated
  useEffect(() => {
    const run = async () => {
      if (!associations.length) {
        setOffersCandidates([]); setHiredCandidates([]); setRejectedCandidates([]); setAllAssociatedCandidates([]); return
      }
      const allIdsAll = Array.from(new Set(associations.map(a => a.candidate_id)))
      const offerIds = associations
        .filter(a => a.status !== 'rejected' && (a.status === 'offer' || (a.current_stage_id && stageMap[a.current_stage_id!]?.type === 'offer')))
        .map(a => a.candidate_id)
      const hiredIds = associations.filter(a => a.status === 'hired').map(a => a.candidate_id)
      const rejectedIds = associations.filter(a => a.status === 'rejected').map(a => a.candidate_id)
      setStatusListsLoading(true)
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .in('id', allIdsAll)
      if (error) {
        console.error('Failed to load candidate details for status lists', error)
        setStatusListsLoading(false)
        return
      }
      const byId = new Map((data || []).map((c: any) => [c.id, c]))
      setOffersCandidates(offerIds.map((id) => byId.get(id)).filter(Boolean))
      setHiredCandidates(hiredIds.map((id) => byId.get(id)).filter(Boolean))
      setRejectedCandidates(rejectedIds.map((id) => byId.get(id)).filter(Boolean))
      setAllAssociatedCandidates(allIdsAll.map((id) => byId.get(id)).filter(Boolean))
      setStatusListsLoading(false)
    }
    run()
  }, [associations, stageMap])

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

  const handleRejectSelected = async () => {
    if (!id || selectedCandidateIds.length === 0) return
    try {
      const list = await fetchAssociationsForJob(id)
      const targets = list.filter(a => selectedCandidateIds.includes(a.candidate_id) && a.status !== 'rejected' && a.status !== 'hired')
      await Promise.all(targets.map(a => updateAssociationStatus(a.id, 'rejected')))
      toast({ title: 'Rejected', description: `${targets.length} candidate(s) rejected.` })
      setPipelineRefresh((v) => v + 1)
      setSelectedCandidateIds([])
    } catch (e) {
      console.error('Error rejecting candidates:', e)
      toast({ title: 'Error', description: 'Failed to reject selected candidates', variant: 'destructive' })
    }
  }

  const handleAddCandidate = async (candidateData: any) => {
    try {
      const created = await addCandidate(candidateData)
      setShowAddCandidate(false)
      return created
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

        {!isMobile && (
          <div className="mb-2 animate-fade-in">
            <PageHeader title={job.title} compact>
              {permissions.canEditJobs && job.status !== 'archived' && (
                <Button variant="outline" onClick={handleArchiveJob} className="gap-2">
                  <Archive className="h-4 w-4" />
                  Archive Job
                </Button>
              )}
            </PageHeader>
          </div>
        )}

        {/* Desktop Header with Back and Archive buttons - separate from content */}
        {!isMobile && (
          <div className="flex items-center justify-between mb-6">
            <Button variant="outline" onClick={handleBackToJobs} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Jobs
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            // Mobile: Tabs
            <>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="candidates">Job Dashboard</TabsTrigger>
                  <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
                  <TabsTrigger value="job-setup">Setup</TabsTrigger>
                </TabsList>
              
              
              <TabsContent value="candidates">
                <div className="space-y-6">
                  <SalaryInsightsCard 
                    candidates={allAssociatedCandidates.length ? allAssociatedCandidates : applicationReviewCandidates}
                    jobCurrency={job.currency || 'USD'}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="text-sm text-text-secondary">Active Candidates</div>
                        <div className="text-3xl font-semibold text-text-primary">{activeCount}</div>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="text-sm text-text-secondary">Offers</div>
                        <div className="text-3xl font-semibold text-text-primary">{offerCount}</div>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="text-sm text-text-secondary">Hired</div>
                        <div className="text-3xl font-semibold text-text-primary">{hiredCount}</div>
                      </CardHeader>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="text-sm text-text-secondary">Rejected</div>
                        <div className="text-3xl font-semibold text-text-primary">{rejectedCount}</div>
                      </CardHeader>
                    </Card>
                  </div>
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
                   <Card className="mb-4">
                     <CardHeader className="py-3">
                       <Tabs value={pipelineSectionTab} onValueChange={(v) => setPipelineSectionTab(v as any)}>
                         <TabsList className="w-full h-14 p-2 gap-2">
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple" value="application">
                              <span className="flex items-center gap-2">
                                <span>Application Review</span>
                                <Badge variant="pastel-purple">{applicationCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow" value="recruiting">
                              <span className="flex items-center gap-2">
                                <span className="text-text-primary">Recruiting Process</span>
                                <Badge variant="pastel-yellow">{recruitingCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue" value="offers">
                              <span className="flex items-center gap-2">
                                <span>Job Offers</span>
                                <Badge variant="pastel-blue">{offerCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-success/20 text-text-primary data-[state=active]:bg-success" value="hired">
                              <span className="flex items-center gap-2">
                                <span>Hired Candidates</span>
                                <Badge variant="success">{hiredCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-destructive/20 text-text-primary data-[state=active]:bg-destructive" value="rejected">
                              <span className="flex items-center gap-2">
                                <span>Rejected Candidates</span>
                                <Badge variant="destructive">{rejectedCount}</Badge>
                              </span>
                            </TabsTrigger>
                         </TabsList>
                       </Tabs>
                     </CardHeader>
                   </Card>
                   <Card className="h-full w-full overflow-hidden flex flex-col">
                    <CardHeader className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/60 border-b border-border">
                      <div className="flex items-start justify-between">
                        <div>
                          <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
                          <p className="text-sm text-text-secondary">Drag candidates across stages. Scroll horizontally to view more columns.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!selectionMode && (
                            <Button
                              size="sm"
                              className="gap-sm h-[36px]"
                              onClick={() => setShowAddCandidate(true)}
                            >
                              <UserPlus className="h-4 w-4" />
                              Add Candidate
                            </Button>
                          )}
                          {pipelineSectionTab === 'recruiting' ? (
                            <>
                              {selectionMode && selectedCandidateIds.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <BulkMoveJobCandidatesToPipelineDialog
                                    jobId={id!}
                                    candidates={selectedCandidateIds.map(candidateId => ({ id: candidateId, candidate_name: '', location_country: null, location_state: null, location_city: null, salary_amount: null, salary_currency: null, salary_period: null, profile_summary: null, linkedin_url: null, skills: null }))}
                                    onCompleted={() => { 
                                      setSelectedCandidateIds([])
                                      setSelectionMode(false)
                                      setPipelineRefresh((v) => v + 1)
                                    }}
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="gap-2"
                                    disabled={selectedCandidateIds.length === 0}
                                    onClick={async () => {
                                      // Archive selected candidates logic would go here
                                      // For now, just clear selection
                                      setSelectedCandidateIds([])
                                      setSelectionMode(false)
                                    }}
                                  >
                                    <Archive className="h-4 w-4" />
                                    Archive
                                  </Button>
                                </div>
                              )}
                              {selectionMode && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={selectedCandidateIds.length === 0}
                                  onClick={handleRejectSelected}
                                >
                                  Reject
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={selectionMode ? 'secondary' : 'outline'}
                                onClick={() => setSelectionMode((v) => !v)}
                                aria-pressed={selectionMode}
                              >
                                Select
                              </Button>
                                <TooltipProvider delayDuration={200}>
                                  <ToggleGroup
                                    type="single"
                                    value={pipelineView}
                                    onValueChange={(v) => v && setPipelineView(v as 'board' | 'list')}
                                    size="sm"
                                    variant="outline"
                                    className="rounded-full border border-border/40 bg-surface-secondary/60 p-1"
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <ToggleGroupItem value="board" aria-label="Board view" className="rounded-full">
                                          <LayoutGrid className="h-4 w-4" />
                                        </ToggleGroupItem>
                                      </TooltipTrigger>
                                      <TooltipContent>Board</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <ToggleGroupItem value="list" aria-label="List view" className="rounded-full">
                                          <List className="h-4 w-4" />
                                        </ToggleGroupItem>
                                      </TooltipTrigger>
                                      <TooltipContent>List</TooltipContent>
                                    </Tooltip>
                                  </ToggleGroup>
                                </TooltipProvider>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant={tableSelectionMode ? 'secondary' : 'outline'}
                                onClick={() => setTableSelectionMode((v) => !v)}
                                aria-pressed={tableSelectionMode}
                              >
                                Select
                              </Button>
                            )}
                        </div>
                          </div>
                        </CardHeader>
                      <CardContent className="p-0 h-0 flex-1">
                        <ScrollArea className="h-full w-full scrollbar-black">
                          {pipelineSectionTab === 'recruiting' ? (
                            <div className={pipelineView === 'list' ? 'w-full p-layout-md' : 'w-fit p-layout-md'}>
                              <PipelineOverview
                                jobId={id!}
                                showHeader={false}
                                externalScroll
                                viewMode={pipelineView}
                                onViewModeChange={setPipelineView}
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                onSelectedIdsChange={setSelectedCandidateIds}
                                refreshToken={pipelineRefresh}
                                onStageChanged={() => setPipelineRefresh((v) => v + 1)}
                              />
                            </div>
                          ) : pipelineSectionTab === 'application' ? (
                            <div className="w-full p-layout-md">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Active Candidates</div>
                          <div className="text-3xl font-semibold text-text-primary">{activeCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Offers</div>
                          <div className="text-3xl font-semibold text-text-primary">{offerCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Hired</div>
                          <div className="text-3xl font-semibold text-text-primary">{hiredCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Rejected</div>
                          <div className="text-3xl font-semibold text-text-primary">{rejectedCount}</div>
                        </CardHeader>
                      </Card>
                    </div>
                            </div>
                          ) : pipelineSectionTab === 'offers' ? (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={offersCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openOffersProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          ) : pipelineSectionTab === 'hired' ? (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={hiredCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openHiredProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          ) : (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={rejectedCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openRejectedProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          )}
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
                      candidates={allAssociatedCandidates.length ? allAssociatedCandidates : applicationReviewCandidates}
                      jobCurrency={job.currency || 'USD'}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Active Candidates</div>
                          <div className="text-3xl font-semibold text-text-primary">{activeCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Offers</div>
                          <div className="text-3xl font-semibold text-text-primary">{offerCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Hired</div>
                          <div className="text-3xl font-semibold text-text-primary">{hiredCount}</div>
                        </CardHeader>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="text-sm text-text-secondary">Rejected</div>
                          <div className="text-3xl font-semibold text-text-primary">{rejectedCount}</div>
                        </CardHeader>
                      </Card>
                    </div>
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
                    <Card className="mb-4">
                      <CardHeader className="py-3">
                        <Tabs value={pipelineSectionTab} onValueChange={(v) => setPipelineSectionTab(v as any)}>
                          <TabsList className="w-full h-14 p-2 gap-2">
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple" value="application">
                              <span className="flex items-center gap-2">
                                <span>Application Review</span>
                                <Badge variant="pastel-purple">{applicationCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow" value="recruiting">
                              <span className="flex items-center gap-2">
                                <span className="text-text-primary">Recruiting Process</span>
                                <Badge variant="pastel-yellow">{recruitingCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue" value="offers">
                              <span className="flex items-center gap-2">
                                <span>Job Offers</span>
                                <Badge variant="pastel-blue">{offerCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-success/20 text-text-primary data-[state=active]:bg-success" value="hired">
                              <span className="flex items-center gap-2">
                                <span>Hired Candidates</span>
                                <Badge variant="success">{hiredCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="flex-1 h-10 md:h-12 text-base md:text-lg bg-destructive/20 text-text-primary data-[state=active]:bg-destructive" value="rejected">
                              <span className="flex items-center gap-2">
                                <span>Rejected Candidates</span>
                                <Badge variant="destructive">{rejectedCount}</Badge>
                              </span>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </CardHeader>
                    </Card>
                    <Card className="h-full w-full overflow-hidden flex flex-col">
                      <CardHeader className="sticky top-0 z-10 bg-surface-primary/80 backdrop-blur supports-[backdrop-filter]:bg-surface-primary/60 border-b border-border">
                        <div className="flex items-start justify-between">
                          <div>
                            <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
                            <p className="text-sm text-text-secondary">Drag candidates across stages. Scroll horizontally to view more columns.</p>
                          </div>
                            <div className="flex items-center gap-2">
                              {!selectionMode && (
                                <Button
                                  size="sm"
                                  className="gap-sm h-[36px]"
                                  onClick={() => setShowAddCandidate(true)}
                                >
                                  <UserPlus className="h-4 w-4" />
                                  Add Candidate
                                </Button>
                              )}
                              {pipelineSectionTab === 'recruiting' ? (
                                <>
                                  {selectionMode && selectedCandidateIds.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <BulkMoveJobCandidatesToPipelineDialog
                                        jobId={id!}
                                        candidates={selectedCandidateIds.map(candidateId => ({ id: candidateId, candidate_name: '', location_country: null, location_state: null, location_city: null, salary_amount: null, salary_currency: null, salary_period: null, profile_summary: null, linkedin_url: null, skills: null }))}
                                        onCompleted={() => { 
                                          setSelectedCandidateIds([])
                                          setSelectionMode(false)
                                          setPipelineRefresh((v) => v + 1)
                                        }}
                                      />
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="gap-2"
                                        disabled={selectedCandidateIds.length === 0}
                                        onClick={async () => {
                                          // Archive selected candidates logic would go here
                                          // For now, just clear selection
                                          setSelectedCandidateIds([])
                                          setSelectionMode(false)
                                        }}
                                      >
                                        <Archive className="h-4 w-4" />
                                        Archive
                                      </Button>
                                    </div>
                                  )}
                                  {selectionMode && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      disabled={selectedCandidateIds.length === 0}
                                      onClick={handleRejectSelected}
                                    >
                                      Reject
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={selectionMode ? 'secondary' : 'outline'}
                                    onClick={() => setSelectionMode((v) => !v)}
                                    aria-pressed={selectionMode}
                                  >
                                    Select
                                  </Button>
                                  <TooltipProvider delayDuration={200}>
                                    <ToggleGroup
                                      type="single"
                                      value={pipelineView}
                                      onValueChange={(v) => v && setPipelineView(v as 'board' | 'list')}
                                      size="sm"
                                      variant="outline"
                                      className="rounded-full border border-border/40 bg-surface-secondary/60 p-1"
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <ToggleGroupItem value="board" aria-label="Board view" className="rounded-full">
                                            <LayoutGrid className="h-4 w-4" />
                                          </ToggleGroupItem>
                                        </TooltipTrigger>
                                        <TooltipContent>Board</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <ToggleGroupItem value="list" aria-label="List view" className="rounded-full">
                                            <List className="h-4 w-4" />
                                          </ToggleGroupItem>
                                        </TooltipTrigger>
                                        <TooltipContent>List</TooltipContent>
                                      </Tooltip>
                                    </ToggleGroup>
                                  </TooltipProvider>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={tableSelectionMode ? 'secondary' : 'outline'}
                                  onClick={() => setTableSelectionMode((v) => !v)}
                                  aria-pressed={tableSelectionMode}
                                >
                                  Select
                                </Button>
                              )}
                            </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0 h-0 flex-1">
                        <ScrollArea className="h-full w-full scrollbar-black">
                          {pipelineSectionTab === 'recruiting' ? (
                            <div className={pipelineView === 'list' ? 'w-full p-layout-md' : 'w-fit p-layout-md'}>
                              <PipelineOverview
                                jobId={id!}
                                showHeader={false}
                                externalScroll
                                viewMode={pipelineView}
                                onViewModeChange={setPipelineView}
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                onSelectedIdsChange={setSelectedCandidateIds}
                                  refreshToken={pipelineRefresh}
                                  onStageChanged={() => setPipelineRefresh((v) => v + 1)}
                              />
                            </div>
                          ) : pipelineSectionTab === 'application' ? (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={applicationReviewCandidates}
                                isLoading={candidatesLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={markCandidateAsViewed}
                                isCandidateNewForUser={isCandidateNewForUser}
                                onRowClick={handleApplicationRowClick}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          ) : pipelineSectionTab === 'offers' ? (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={offersCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openOffersProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          ) : pipelineSectionTab === 'hired' ? (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={hiredCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openHiredProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          ) : (
                            <div className="w-full p-layout-md">
                              <CandidateTable
                                candidates={rejectedCandidates}
                                isLoading={statusListsLoading}
                                onEdit={handleEditCandidate}
                                onDelete={handleDeleteCandidate}
                                markCandidateAsViewed={() => {}}
                                isCandidateNewForUser={() => false}
                                onRowClick={openRejectedProfile}
                                selectionMode={tableSelectionMode}
                                onSelectionModeChange={setTableSelectionMode}
                              />
                            </div>
                          )}
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

        {/* Add Candidate Sheet */}
        <CandidateFormSheet
          isOpen={showAddCandidate}
          onClose={() => setShowAddCandidate(false)}
          jobId={id!}
        />

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

        <CandidateProfileSheet
          open={profileOpen}
          onOpenChange={setProfileOpen}
          candidateId={profileCandidateId}
          jobId={id!}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          onStageChanged={() => setPipelineRefresh((v) => v + 1)}
        />
      </div>
    </div>
  )
}
