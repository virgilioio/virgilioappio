import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useJobs } from '@/hooks/useJobs'
import { JobDetailFloatingSidebar } from '@/components/jobs/JobDetailFloatingSidebar'
import { JobDetailMobileHeader } from '@/components/jobs/JobDetailMobileHeader'
import { PageHeader } from '@/components/layout/PageHeader'

import { CandidateTable } from '@/components/candidates/CandidateTable'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'
import { JobAssignmentsPanel } from '@/components/jobs/JobAssignmentsPanel'
import { JobSetupPanel } from '@/components/jobs/JobSetupPanel'
import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Archive, LayoutGrid, List, UserPlus, Sparkles, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { SalaryInsightsCard } from '@/components/jobs/SalaryInsightsCard'
import { JobAnalyticsDashboard } from '@/components/jobs/JobAnalyticsDashboard'
import { PipelineOverview } from '@/components/jobs/PipelineOverview'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { usePipelineActions, PipelineAssociation } from '@/hooks/usePipelineActions'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import BulkMoveJobCandidatesToPipelineDialog from '@/components/candidates/BulkMoveJobCandidatesToPipelineDialog'
import { BulkRejectionDialog } from '@/components/candidates/BulkRejectionDialog'
import { BulkEmailDialog } from '@/components/candidates/BulkEmailDialog'
import { useJobMatchingCandidates, MatchedCandidate } from '@/hooks/useJobMatchingCandidates'
import { useJobMatchingCandidatesCount } from '@/hooks/useJobMatchingCandidatesCount'
import { useRealTimeSkillMatching } from '@/hooks/useRealTimeSkillMatching'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [showBulkRejectionDialog, setShowBulkRejectionDialog] = useState(false)
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false)

  // In-place profile sheet state with navigation
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileCandidateId, setProfileCandidateId] = useState<string | null>(null)
  const [profileContext, setProfileContext] = useState<'application' | 'pipeline' | 'suggested' | null>(null)
  const [profileCandidateList, setProfileCandidateList] = useState<any[]>([])
  const [profileCurrentIndex, setProfileCurrentIndex] = useState(0)
  
  // Apollo candidate state for suggested tab
  const [selectedApolloId, setSelectedApolloId] = useState<string | null>(null)
  const [selectedApolloData, setSelectedApolloData] = useState<any>(null)
  
  // Auto-open scorecard from URL parameter (for AI note-taker notifications)
  const [autoOpenScorecard, setAutoOpenScorecard] = useState(false)

  // Helper to update URL with candidate parameter
  const updateCandidateUrl = (candidateId: string | null) => {
    if (candidateId) {
      setSearchParams({ candidate: candidateId }, { replace: true })
    } else {
      // Remove candidate param when closing
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('candidate')
      setSearchParams(newParams, { replace: true })
    }
  }

  // Helper to get candidate ID from URL
  const getCandidateIdFromUrl = () => {
    return searchParams.get('candidate')
  }

  const openProfileInPlace = (candidateId: string, context: 'application' | 'pipeline' | 'suggested' = 'application', candidateList: any[] = []) => {
    const index = candidateList.findIndex((c: any) => c.id === candidateId || c.candidate_id === candidateId)
    setProfileCandidateId(candidateId)
    setProfileContext(context)
    setProfileCandidateList(candidateList)
    setProfileCurrentIndex(index >= 0 ? index : 0)
    setProfileOpen(true)
    // Clear Apollo state when opening non-Apollo profiles
    setSelectedApolloId(null)
    setSelectedApolloData(null)
    
    // Update URL
    updateCandidateUrl(candidateId)
  }

  // Navigation functions for profile sheet
  const handleNavigatePrev = () => {
    if (profileCurrentIndex > 0) {
      const newIndex = profileCurrentIndex - 1
      const candidate = profileCandidateList[newIndex]
      if (candidate) {
        setProfileCurrentIndex(newIndex)
        
        // Handle Apollo vs local candidates for suggested context
        if (profileContext === 'suggested' && candidate.source === 'apollo' && !candidate.candidate_id) {
          setSelectedApolloId(candidate.apollo_id || candidate.id)
          setSelectedApolloData({
            candidate_name: candidate.candidate_name,
            headline: candidate.headline,
            current_company: candidate.current_company,
            current_role: candidate.current_role,
            location: candidate.location,
            linkedin_url: candidate.linkedin_url,
            has_email: candidate.has_email,
            has_phone: candidate.has_phone,
            apollo_score: candidate.apollo_score
          })
          setProfileCandidateId(null)
        } else {
          setSelectedApolloId(null)
          setSelectedApolloData(null)
          setProfileCandidateId(candidate.candidate_id || candidate.id)
        }
        
        updateCandidateUrl(candidate.id)
      }
    }
  }

  const handleNavigateNext = () => {
    if (profileCurrentIndex < profileCandidateList.length - 1) {
      const newIndex = profileCurrentIndex + 1
      const candidate = profileCandidateList[newIndex]
      if (candidate) {
        setProfileCurrentIndex(newIndex)
        
        // Handle Apollo vs local candidates for suggested context
        if (profileContext === 'suggested' && candidate.source === 'apollo' && !candidate.candidate_id) {
          setSelectedApolloId(candidate.apollo_id || candidate.id)
          setSelectedApolloData({
            candidate_name: candidate.candidate_name,
            headline: candidate.headline,
            current_company: candidate.current_company,
            current_role: candidate.current_role,
            location: candidate.location,
            linkedin_url: candidate.linkedin_url,
            has_email: candidate.has_email,
            has_phone: candidate.has_phone,
            apollo_score: candidate.apollo_score
          })
          setProfileCandidateId(null)
        } else {
          setSelectedApolloId(null)
          setSelectedApolloData(null)
          setProfileCandidateId(candidate.candidate_id || candidate.id)
        }
        
        updateCandidateUrl(candidate.id)
      }
    }
  }

  // Wrapper for opening pipeline candidates with URL support
  const openPipelineProfile = (candidateId: string) => {
    const allPipelineCandidates = [
      ...recruitingProcessCandidates,
      ...matchingCandidates,
      ...offersCandidates, 
      ...hiredCandidates,
      ...rejectedCandidates
    ];
    openProfileInPlace(candidateId, 'pipeline', allPipelineCandidates);
  }

  const hasPrev = profileCurrentIndex > 0
  const hasNext = profileCurrentIndex < profileCandidateList.length - 1

  // Create wrapper functions for different candidate contexts
  const openApplicationProfile = (candidateId: string) => openProfileInPlace(candidateId, 'application', applicationReviewCandidates)
  const openOffersProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', offersCandidates)
  const openHiredProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', hiredCandidates)
  const openRejectedProfile = (candidateId: string) => openProfileInPlace(candidateId, 'pipeline', rejectedCandidates)
  // Handle opening suggested/matched candidate profiles (may be Apollo or local)
  const openSuggestedProfile = (candidateId: string) => {
    const candidate = matchingCandidates.find((c: MatchedCandidate) => c.id === candidateId)
    
    if (candidate?.source === 'apollo' && !candidate?.candidate_id) {
      // Uncollected Apollo candidate - show Apollo preview sheet
      setSelectedApolloId(candidate.apollo_id || candidate.id)
      setSelectedApolloData({
        candidate_name: candidate.candidate_name,
        headline: candidate.headline,
        current_company: candidate.current_company,
        current_role: candidate.current_role,
        location: candidate.location,
        linkedin_url: candidate.linkedin_url,
        has_email: candidate.has_email,
        has_phone: candidate.has_phone,
        apollo_score: candidate.apollo_score
      })
      setProfileCandidateId(null) // No real candidate ID yet
      setProfileContext('suggested')
      setProfileCandidateList(matchingCandidates)
      const index = matchingCandidates.findIndex((c: MatchedCandidate) => c.id === candidateId)
      setProfileCurrentIndex(index >= 0 ? index : 0)
      setProfileOpen(true)
      updateCandidateUrl(candidateId)
    } else {
      // Local or collected candidate - use regular candidate profile
      setSelectedApolloId(null)
      setSelectedApolloData(null)
      const realCandidateId = candidate?.candidate_id || candidateId
      openProfileInPlace(realCandidateId, 'suggested', matchingCandidates)
    }
  }

  // Inner tabs for Pipeline section
  const [pipelineSectionTab, setPipelineSectionTab] = useState<'suggested' | 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'>('recruiting')

  // Assocations and status-based lists
  const { fetchAssociationsForJob, updateAssociationStatus } = usePipelineActions()
  const [associations, setAssociations] = useState<PipelineAssociation[]>([])
  const [stageMap, setStageMap] = useState<Record<string, { type: string; name: string }>>({})
  const [offersCandidates, setOffersCandidates] = useState<any[]>([])
  const [hiredCandidates, setHiredCandidates] = useState<any[]>([])
  const [rejectedCandidates, setRejectedCandidates] = useState<any[]>([])
  const [recruitingProcessCandidates, setRecruitingProcessCandidates] = useState<any[]>([])
  const [suggestedCandidates, setSuggestedCandidates] = useState<any[]>([])
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
    if (!candidates?.length) return []
    return candidates.filter((c: any) => {
      const link = normalizeUrl(c.linkedin_url)
      if (link && inPipelineKeys.has('link:' + link)) return false
      const key = 'name:' + makeNameLocKey(c.candidate_name, c.location_city, c.location_country)
      return !inPipelineKeys.has(key)
    }).map((c: any) => ({
      ...c,
      // Ensure all required fields are present for CandidateTable compatibility
      job_id: c.job_id || id, // Use current job ID if not set
      notes: c.notes || c.association_notes || null,
      added_by: c.added_by || null,
      first_viewed_by: c.first_viewed_by || {}
    }))
  }, [candidates, inPipelineKeys, id])

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
  const totalCandidates = useMemo(() => associations.length, [associations])
  const recruitingCount = useMemo(() => 
    associations.filter(a => 
      a.status !== 'rejected' && 
      a.status !== 'hired' && 
      a.status !== 'offer' &&
      a.current_stage_id &&
      stageMap[a.current_stage_id]?.type !== 'offer'
    ).length, 
    [associations, stageMap]
  )
  const applicationCount = useMemo(() => (applicationReviewCandidates?.length ?? 0), [applicationReviewCandidates])
  // Real-time skill matching for suggested count (using existing job from query below)  
  const { matchingData: skillMatchingData } = useRealTimeSkillMatching({
    skills: [],
    location: '',
    salaryMin: 0,
    salaryMax: 0,
    currency: 'USD'
  })

  // Background count hook - always enabled for tab badge
  const { count: suggestedCount } = useJobMatchingCandidatesCount({
    jobId: id || '',
    enabled: !!id
  })

  // Note: AI matching candidates hook will be moved after job query
  
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
        setOffersCandidates([]); setHiredCandidates([]); setRejectedCandidates([]); setRecruitingProcessCandidates([]); setAllAssociatedCandidates([]); return
      }
      const allIdsAll = Array.from(new Set(associations.map(a => a.candidate_id)))
      const offerIds = associations
        .filter(a => a.status !== 'rejected' && (a.status === 'offer' || (a.current_stage_id && stageMap[a.current_stage_id!]?.type === 'offer')))
        .map(a => a.candidate_id)
      const hiredIds = associations.filter(a => a.status === 'hired').map(a => a.candidate_id)
      const rejectedIds = associations.filter(a => a.status === 'rejected').map(a => a.candidate_id)
      const recruitingIds = associations
        .filter(a => 
          a.status !== 'rejected' && 
          a.status !== 'hired' && 
          a.status !== 'offer' &&
          a.current_stage_id &&
          stageMap[a.current_stage_id]?.type !== 'offer'
        )
        .map(a => a.candidate_id)
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
      setRecruitingProcessCandidates(recruitingIds.map((id) => byId.get(id)).filter(Boolean))
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
            name
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

  // AI matching candidates hook - only load when suggested tab is active
  const { candidates: matchingCandidates, isLoading: isLoadingMatches, refetch: refetchMatches } = useJobMatchingCandidates({
    jobId: id || '',
    enabled: !!id && pipelineSectionTab === 'suggested',
    jobSkills: job?.skills // Pass job skills to trigger refresh when they change
  })

  // Handle URL candidate parameter on mount and when URL changes
  useEffect(() => {
    const candidateIdFromUrl = getCandidateIdFromUrl()
    const openParam = searchParams.get('open')
    
    // Handle ?open=scorecard parameter
    if (openParam === 'scorecard' && candidateIdFromUrl) {
      setAutoOpenScorecard(true)
      // Clean up the 'open' param from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('open')
      setSearchParams(newParams, { replace: true })
    }
    
    if (candidateIdFromUrl && candidateIdFromUrl !== profileCandidateId) {
      // Check if candidate exists in any of the candidate lists
      const allLists = [
        { list: applicationReviewCandidates, context: 'application' as const },
        { list: matchingCandidates, context: 'pipeline' as const },
        { list: offersCandidates, context: 'pipeline' as const },
        { list: hiredCandidates, context: 'pipeline' as const },
        { list: rejectedCandidates, context: 'pipeline' as const },
      ]
      
      for (const { list, context } of allLists) {
        const candidate = list.find(c => c.id === candidateIdFromUrl)
        if (candidate) {
          openProfileInPlace(candidateIdFromUrl, context, list)
          return
        }
      }
      
      // If not found in any list, still try to open (may load independently)
      setProfileCandidateId(candidateIdFromUrl)
      setProfileContext('application')
      setProfileCandidateList([])
      setProfileCurrentIndex(0)
      setProfileOpen(true)
    } else if (!candidateIdFromUrl && profileOpen) {
      // URL has no candidate param but sheet is open - this means user pressed back
      setProfileOpen(false)
      setAutoOpenScorecard(false) // Reset scorecard auto-open when profile closes
    }
  }, [searchParams, applicationReviewCandidates, matchingCandidates, offersCandidates, hiredCandidates, rejectedCandidates, profileCandidateId, profileOpen])

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
      // Refetch matching candidates if skills may have changed
      if (pipelineSectionTab === 'suggested') {
        console.log('🔄 Job updated, refreshing matching candidates...')
        refetchMatches()
      }
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

  const handleBulkRejectionSuccess = () => {
    setPipelineRefresh((v) => v + 1)
    setSelectedCandidateIds([])
    setSelectionMode(false)
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
      <div className="container mx-auto pt-2 pb-4 sm:pt-3 sm:pb-6 lg:pt-4 lg:pb-8 px-4 sm:px-6 lg:px-8">
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
          <>
            <div className="mb-4 animate-fade-in">
              <Button variant="outline" onClick={handleBackToJobs} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Jobs
              </Button>
            </div>
            
            <div className="mb-2 animate-fade-in">
              <PageHeader 
                title={job.title} 
                compact
                metrics={[
                  { label: 'Total Candidates', value: totalCandidates },
                  { label: 'Active Candidates', value: activeCount },
                  { label: 'Hired Candidates', value: hiredCount },
                  { label: 'Rejected Candidates', value: rejectedCount }
                ]}
              />
            </div>
          </>
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
                <JobAnalyticsDashboard 
                  jobId={id!}
                  candidates={allAssociatedCandidates.length ? allAssociatedCandidates : applicationReviewCandidates}
                  jobCurrency={job.currency || 'USD'}
                />
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
                  onArchive={handleArchiveJob}
                />
              </TabsContent>
               <TabsContent value="pipeline">
                 <div className="h-[calc(100svh-16rem)] sm:h-[calc(100svh-14rem)] min-h-0">
                   <Card className="mb-4">
                     <CardHeader className="py-3">
                        <Tabs value={pipelineSectionTab} onValueChange={(v) => setPipelineSectionTab(v as any)}>
                          <TabsList className="w-full h-14 p-2 gap-1 grid grid-cols-6">
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white border border-blue-500/20 data-[state=active]:border-blue-500 data-[state=active]:shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(147,51,234,0.3)] data-[state=active]:animate-pulse" value="suggested">
                               <span className="flex items-center gap-1 truncate">
                                 <Sparkles className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                                 <span className="truncate">Suggested</span>
                                 <Badge variant="secondary" className="text-xs flex-shrink-0">{suggestedCount}</Badge>
                               </span>
                             </TabsTrigger>
                             <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple" value="application">
                               <span className="flex items-center gap-1 truncate">
                                 <span className="truncate">Application Review</span>
                                 <Badge variant="pastel-purple" className="text-xs flex-shrink-0">{applicationCount}</Badge>
                               </span>
                             </TabsTrigger>
                             <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow" value="recruiting">
                               <span className="flex items-center gap-1 truncate">
                                 <span className="text-text-primary truncate">Recruiting Process</span>
                                 <Badge variant="pastel-yellow" className="text-xs flex-shrink-0">{recruitingCount}</Badge>
                               </span>
                             </TabsTrigger>
                             <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue" value="offers">
                               <span className="flex items-center gap-1 truncate">
                                 <span className="truncate">Job Offers</span>
                                 <Badge variant="pastel-blue" className="text-xs flex-shrink-0">{offerCount}</Badge>
                               </span>
                             </TabsTrigger>
                             <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-success/20 text-text-primary data-[state=active]:bg-success" value="hired">
                               <span className="flex items-center gap-1 truncate">
                                 <span className="truncate">Hired Candidates</span>
                                 <Badge variant="success" className="text-xs flex-shrink-0">{hiredCount}</Badge>
                               </span>
                             </TabsTrigger>
                             <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-destructive/20 text-text-primary data-[state=active]:bg-destructive" value="rejected">
                               <span className="flex items-center gap-1 truncate">
                                 <span className="truncate">Rejected Candidates</span>
                                 <Badge variant="destructive" className="text-xs flex-shrink-0">{rejectedCount}</Badge>
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
                          {/* Debug: Selection state */}
                          <div className="text-xs text-red-500 border border-red-200 p-1 rounded">
                            Mode: {selectionMode ? 'ON' : 'OFF'} | Selected: {selectedCandidateIds.length} | Tab: {pipelineSectionTab}
                          </div>
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
                          {pipelineSectionTab === 'recruiting' ? (
                            <>
                              {selectionMode && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={selectedCandidateIds.length === 0}
                                    onClick={() => setShowBulkEmailDialog(true)}
                                  >
                                    <Mail className="h-4 w-4 mr-2" />
                                    Email
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={selectedCandidateIds.length === 0}
                                    onClick={() => setShowBulkRejectionDialog(true)}
                                  >
                                    Reject
                                  </Button>
                                </>
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
                                onCandidateClick={openPipelineProfile}
                              />
                            </div>
                            ) : pipelineSectionTab === 'suggested' ? (
                              <div className="w-full p-layout-md">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-medium text-text-primary">
                                      AI-Matched Candidates
                                    </span>
                                    {matchingCandidates && matchingCandidates.length > 0 && (
                                      <Badge variant="secondary" className="text-xs">
                                        {matchingCandidates.length} matches
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {isLoadingMatches ? (
                                    <div className="text-center py-8">
                                      <div className="text-text-tertiary text-sm">
                                        Finding the best matching candidates...
                                      </div>
                                    </div>
                                   ) : matchingCandidates && matchingCandidates.length > 0 ? (
                                     <CandidateTable
                                       candidates={matchingCandidates as any}
                                       isLoading={false}
                                       onEdit={() => {}}
                                       onDelete={() => {}}
                                       markCandidateAsViewed={() => {}}
                                       isCandidateNewForUser={() => false}
                                       onRowClick={openSuggestedProfile}
                                       hideActions={true}
                                       showMatchScore={true}
                                     />
                                  ) : (
                                    <div className="text-center py-8">
                                      <div className="text-text-tertiary text-sm">
                                        No matching candidates found. Try adjusting the job requirements or add more skills.
                                      </div>
                                    </div>
                                  )}
                                </div>
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
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
                  <JobAnalyticsDashboard 
                    jobId={id!}
                    candidates={allAssociatedCandidates.length ? allAssociatedCandidates : applicationReviewCandidates}
                    jobCurrency={job.currency || 'USD'}
                  />
                </TabsContent>
                
                {/* All Candidates Tab */}
                <TabsContent value="all-candidates">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <h2 className="text-2xl font-semibold">All Candidates</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          {allAssociatedCandidates.length} candidate{allAssociatedCandidates.length !== 1 ? 's' : ''} associated with this job
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CandidateTable
                        candidates={allAssociatedCandidates}
                        isLoading={statusListsLoading}
                        onRowClick={(candidateId) => openProfileInPlace(candidateId, 'pipeline', allAssociatedCandidates)}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        markCandidateAsViewed={markCandidateAsViewed}
                        isCandidateNewForUser={isCandidateNewForUser}
                        showJobInfo={false}
                        hideActions={true}
                      />
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Pipeline Tab */}
                <TabsContent value="pipeline">
                  <div className="h-[calc(100vh-12rem)] min-h-0">
                    <Card className="mb-4">
                      <CardHeader className="py-3">
                        <Tabs value={pipelineSectionTab} onValueChange={(v) => setPipelineSectionTab(v as any)}>
                          <TabsList className="w-full h-14 p-2 gap-1 grid grid-cols-6">
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white border border-blue-500/20 data-[state=active]:border-blue-500 data-[state=active]:shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(147,51,234,0.3)] data-[state=active]:animate-pulse" value="suggested">
                              <span className="flex items-center gap-1 truncate">
                                <Sparkles className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                                <span className="truncate">Suggested</span>
                                <Badge variant="secondary" className="text-xs flex-shrink-0">{suggestedCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple" value="application">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">Application Review</span>
                                <Badge variant="pastel-purple" className="text-xs flex-shrink-0">{applicationCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow" value="recruiting">
                              <span className="flex items-center gap-1 truncate">
                                <span className="text-text-primary truncate">Recruiting Process</span>
                                <Badge variant="pastel-yellow" className="text-xs flex-shrink-0">{recruitingCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue" value="offers">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">Job Offers</span>
                                <Badge variant="pastel-blue" className="text-xs flex-shrink-0">{offerCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-success/20 text-text-primary data-[state=active]:bg-success" value="hired">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">Hired Candidates</span>
                                <Badge variant="success" className="text-xs flex-shrink-0">{hiredCount}</Badge>
                              </span>
                            </TabsTrigger>
                            <TabsTrigger className="h-10 md:h-12 text-xs md:text-sm bg-destructive/20 text-text-primary data-[state=active]:bg-destructive" value="rejected">
                              <span className="flex items-center gap-1 truncate">
                                <span className="truncate">Rejected Candidates</span>
                                <Badge variant="destructive" className="text-xs flex-shrink-0">{rejectedCount}</Badge>
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
                                    setSelectedCandidateIds([])
                                    setSelectionMode(false)
                                  }}
                                >
                                  <Archive className="h-4 w-4" />
                                  Archive
                                </Button>
                              </div>
                            )}
                            {pipelineSectionTab === 'recruiting' ? (
                              <>
                                {selectionMode && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={selectedCandidateIds.length === 0}
                                    onClick={() => setShowBulkRejectionDialog(true)}
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
                                onCandidateClick={openPipelineProfile}
                              />
                            </div>
                          ) : pipelineSectionTab === 'suggested' ? (
                            <div className="w-full p-layout-md">
                              <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium text-text-primary">
                                    AI-Matched Candidates
                                  </span>
                                  {matchingCandidates && matchingCandidates.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {matchingCandidates.length} matches
                                    </Badge>
                                  )}
                                </div>
                                
                                {isLoadingMatches ? (
                                  <div className="text-center py-8">
                                    <div className="text-text-tertiary text-sm">
                                      Finding the best matching candidates...
                                    </div>
                                  </div>
                                ) : matchingCandidates && matchingCandidates.length > 0 ? (
                                  <CandidateTable
                                    candidates={matchingCandidates as any}
                                    isLoading={false}
                                    onEdit={() => {}}
                                    onDelete={() => {}}
                                    markCandidateAsViewed={() => {}}
                                    isCandidateNewForUser={() => false}
                                    onRowClick={openSuggestedProfile}
                                    hideActions={true}
                                    showMatchScore={true}
                                  />
                                ) : (
                                  <div className="text-center py-8">
                                    <div className="text-text-tertiary text-sm">
                                      No matching candidates found. Try adjusting the job requirements or add more skills.
                                    </div>
                                  </div>
                                )}
                              </div>
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
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
                                selectionMode={selectionMode}
                                onSelectionModeChange={setSelectionMode}
                                selectedIds={selectedCandidateIds}
                                onSelectedIdsChange={setSelectedCandidateIds}
                              />
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                {/* Job Setup Tab */}
                <TabsContent value="job-setup">
                  <JobSetupPanel
                    jobId={id!}
                    jobTitle={job.title}
                    job={{
                      ...job,
                      hiring_team: (job.hiring_team as any[]) || []
                    }}
                    onEdit={handleEditJob}
                    onArchive={handleArchiveJob}
                  />
                </TabsContent>
              </div>
            </div>
          )}
        </Tabs>

        {/* Edit Job Modal */}
        <JobFormSheet
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
          onSubmit={handleAddCandidate}
          isLoading={false}
        />

        {/* Edit Candidate Dialog */}
        <Dialog open={!!editingCandidate} onOpenChange={() => setEditingCandidate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Candidate</DialogTitle>
            </DialogHeader>
            <CandidateFormSheet
              isOpen={!!editingCandidate}
              onClose={() => setEditingCandidate(null)}
              onSubmit={handleUpdateCandidate}
              candidate={editingCandidate}
              jobId={id!}
              isLoading={candidatesLoading}
            />
          </DialogContent>
        </Dialog>

        {/* Profile Sheet - Use UniversalCandidateProfileSheet for suggested context (handles Apollo vs local) */}
        {profileContext === 'suggested' ? (
          <UniversalCandidateProfileSheet
            open={profileOpen}
            onOpenChange={(open) => {
              setProfileOpen(open)
              if (!open) {
                updateCandidateUrl(null)
                setSelectedApolloId(null)
                setSelectedApolloData(null)
              }
            }}
            candidateId={profileCandidateId}
            apolloId={selectedApolloId}
            apolloData={selectedApolloData}
            jobId={id!}
            context="sourcing"
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigatePrev={handleNavigatePrev}
            onNavigateNext={handleNavigateNext}
            onStageChanged={() => setPipelineRefresh((v) => v + 1)}
            searchCriteria={{
              title_keywords: job?.standardized_title ? [job.standardized_title] : [],
              skills: job?.skills || job?.standardized_skills || [],
              locations: job?.standardized_location ? [job.standardized_location] : []
            }}
          />
        ) : (
          <CandidateProfileSheet
            open={profileOpen}
            onOpenChange={(open) => {
              setProfileOpen(open)
              if (!open) {
                updateCandidateUrl(null)
                setAutoOpenScorecard(false)
              }
            }}
            candidateId={profileCandidateId}
            jobId={id!}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onNavigatePrev={handleNavigatePrev}
            onNavigateNext={handleNavigateNext}
            onStageChanged={() => setPipelineRefresh((v) => v + 1)}
            autoOpenScorecard={autoOpenScorecard}
            onScorecardOpened={() => setAutoOpenScorecard(false)}
          />
        )}

        <BulkRejectionDialog
          open={showBulkRejectionDialog}
          onOpenChange={setShowBulkRejectionDialog}
          candidateIds={selectedCandidateIds}
          jobId={id!}
          onSuccess={handleBulkRejectionSuccess}
        />

        <BulkEmailDialog
          open={showBulkEmailDialog}
          onOpenChange={setShowBulkEmailDialog}
          candidateIds={selectedCandidateIds}
          jobId={id!}
          onSuccess={() => {
            setSelectedCandidateIds([])
            setSelectionMode(false)
          }}
        />
      </div>
    </div>
  )
}
