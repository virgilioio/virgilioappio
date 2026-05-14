import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useJobRole } from '@/hooks/useJobRole'
import { useCandidates } from '@/hooks/useCandidates'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useJobs } from '@/hooks/useJobs'
import { useJobSourcingProject } from '@/hooks/useJobSourcingProject'
import { useJobPostings } from '@/hooks/useJobPostings'
import { JobSetupLayout } from '@/components/jobs/JobSetupLayout'

import { JobDetailMobileHeader } from '@/components/jobs/JobDetailMobileHeader'

import { JobHero } from '@/components/jobs/JobHero'
import { PipelineSectionTabs, type PipelineSection } from '@/components/jobs/PipelineSectionTabs'

import { CandidateTable } from '@/components/candidates/CandidateTable'
import CandidateFormSheet from '@/components/candidates/CandidateFormSheet'

import { JobFormSheet } from '@/components/jobs/JobFormSheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, Archive, LayoutGrid, List, UserPlus, Sparkles, Mail, ClipboardCheck, Search, Filter, CheckSquare } from 'lucide-react'
import { TableToolbar, TableSearch, TableSegmented } from '@/components/ui/table-toolbar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { Skeleton } from '@/components/ui/skeleton'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { SuggestedCandidatesLoader } from '@/components/sourcing/SuggestedCandidatesLoader'
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
import { CandidateMergeDialog } from '@/components/candidates/CandidateMergeDialog'
import { useJobMatchingCandidates, MatchedCandidate } from '@/hooks/useJobMatchingCandidates'
import { useJobMatchingCandidatesCount } from '@/hooks/useJobMatchingCandidatesCount'
import { useJobSuggestedCandidates, useJobSuggestedCandidatesCount } from '@/hooks/useJobSuggestedCandidates'
import { useRealTimeSkillMatching } from '@/hooks/useRealTimeSkillMatching'
import { ApplicationReviewSheet } from '@/components/candidates/ApplicationReviewSheet'


export default function JobDetail() {
  const params = useParams<{ id?: string; jobId?: string }>()
  const id = params.id || params.jobId
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, userType } = useAuth()
  const permissions = usePermissions()
  const { isHiringManagerOnJob, isInterviewerOnJob } = useJobRole(id)
  const isRestrictedViewer = (isHiringManagerOnJob || isInterviewerOnJob) && !permissions.isAdmin && !permissions.isWorkspaceOwner && !permissions.isPlatformAdmin
  const isMobile = useIsMobile()
  
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [showApplicationReview, setShowApplicationReview] = useState(false)
  const [editingCandidate, setEditingCandidate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('pipeline')
  
  // Guard: reset to allowed tab if restricted viewer lands on a restricted tab
  useEffect(() => {
    if (isRestrictedViewer && (activeTab === 'all-candidates' || activeTab === 'job-setup')) {
      setActiveTab('pipeline')
    }
  }, [isRestrictedViewer, activeTab])
  const [showEditJobModal, setShowEditJobModal] = useState(false)
  const [pipelineView, setPipelineView] = useState<'board' | 'list'>(() => {
    if (typeof window === 'undefined') return isMobile ? 'list' : 'board'
    const saved = localStorage.getItem('jobPipelineView')
    // Default to list view on mobile for better accessibility
    if (saved) return saved === 'list' ? 'list' : 'board'
    return isMobile ? 'list' : 'board'
  })
  useEffect(() => {
    try { localStorage.setItem('jobPipelineView', pipelineView) } catch {}
  }, [pipelineView])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [pipelineSearch, setPipelineSearch] = useState('')
  
  const [pipelineRefresh, setPipelineRefresh] = useState(0)
  const [showBulkRejectionDialog, setShowBulkRejectionDialog] = useState(false)
  const [showBulkEmailDialog, setShowBulkEmailDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existing: any
    incoming: any
    merged: any
  } | null>(null)

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
  const [autoOpenScorecardStageId, setAutoOpenScorecardStageId] = useState<string | null>(null)
  // Auto-open existing scorecard by ID from URL (?scorecard=<id>)
  const [autoOpenScorecardId, setAutoOpenScorecardId] = useState<string | null>(null)

  // Helper to update URL with candidate parameter (preserves scorecard param)
  const updateCandidateUrl = (candidateId: string | null) => {
    const newParams = new URLSearchParams(searchParams)
    if (candidateId) {
      newParams.set('candidate', candidateId)
    } else {
      newParams.delete('candidate')
      newParams.delete('scorecard')
      newParams.delete('open')
      newParams.delete('stage')
    }
    setSearchParams(newParams, { replace: true })
  }

  // Helper to update URL with scorecard parameter (preserves candidate)
  const updateScorecardUrl = (scorecardId: string | null) => {
    const newParams = new URLSearchParams(searchParams)
    if (scorecardId) {
      newParams.set('scorecard', scorecardId)
      newParams.delete('open')
      newParams.delete('stage')
    } else {
      newParams.delete('scorecard')
    }
    setSearchParams(newParams, { replace: true })
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
  // Uses navigation order from PipelineOverview when provided
  const openPipelineProfile = (candidateId: string, navigationOrder?: string[]) => {
    // Build candidate list from all pipeline candidates
    const allPipelineCandidates = [
      ...recruitingProcessCandidates,
      ...matchingCandidates,
      ...offersCandidates, 
      ...hiredCandidates,
      ...rejectedCandidates
    ];
    
    // If we have a navigation order snapshot from PipelineOverview, use it!
    // This ensures navigation matches the exact visual order on the board
    if (navigationOrder && navigationOrder.length > 0) {
      // Create lookup map by candidate_id
      const candidateMap = new Map<string, any>();
      allPipelineCandidates.forEach(c => {
        const id = c.candidate_id || c.id;
        if (id) candidateMap.set(id, c);
      });
      
      // Build ordered list matching the navigation order
      const orderedCandidates = navigationOrder
        .map(id => candidateMap.get(id))
        .filter(Boolean);
      
      // Only use ordered list if we found most candidates (fallback safety)
      if (orderedCandidates.length >= navigationOrder.length * 0.8) {
        openProfileInPlace(candidateId, 'pipeline', orderedCandidates);
        return;
      }
    }
    
    // Fallback to default order
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

  // Force restricted viewers (HM/Interviewer) to 'recruiting' tab only
  useEffect(() => {
    if (isRestrictedViewer && pipelineSectionTab !== 'recruiting') {
      setPipelineSectionTab('recruiting')
    }
  }, [isRestrictedViewer, pipelineSectionTab])

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

  // Sourcing project shortcut
  const { projects: sourcingProjects } = useJobSourcingProject(id)
  const { postings: jobPostings } = useJobPostings(id!)
  const hasJobPosting = (jobPostings || []).some((p) => p.is_active) || (jobPostings || []).length > 0

  // Candidates hook with new functions
  const {
    candidates,
    isLoading: candidatesLoading,
    addCandidate,
    confirmMergeCandidate,
    updateCandidate,
    deleteCandidate,
    markCandidateAsViewed,
    isCandidateNewForUser
  } = useCandidates(id!)

  // Application review candidates derived from associations + stageMap
  const [applicationReviewCandidates, setApplicationReviewCandidates] = useState<any[]>([])

  const applicationReviewStageId = useMemo(() => {
    // Find the job_hiring_stage ID for the application_review stage type
    for (const [jhsId, info] of Object.entries(stageMap)) {
      if (info.type === 'application_review') return jhsId
    }
    return null
  }, [stageMap])

  const applicationCount = useMemo(() => {
    return associations.filter(a => 
      a.status === 'active' && 
      a.current_stage_id === applicationReviewStageId
    ).length
  }, [associations, applicationReviewStageId])

  // Open in-place sheet for Application Review rows
  const handleApplicationRowClick = (candidateId: string) => {
    openProfileInPlace(candidateId, 'application', applicationReviewCandidates)
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
      stageMap[a.current_stage_id]?.type !== 'offer' &&
      stageMap[a.current_stage_id]?.type !== 'application_review'
    ).length, 
    [associations, stageMap]
  )
  // Real-time skill matching for suggested count (using existing job from query below)  
  const { matchingData: skillMatchingData } = useRealTimeSkillMatching({
    skills: [],
    location: '',
    salaryMin: 0,
    salaryMax: 0,
    currency: 'USD'
  })

  // Background count hook - always enabled for tab badge
  const { count: suggestedCount } = useJobSuggestedCandidatesCount({
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

  // Load candidate details for offers/hired/rejected/application-review and all associated
  useEffect(() => {
    const run = async () => {
      if (!associations.length) {
        setOffersCandidates([]); setHiredCandidates([]); setRejectedCandidates([]); setRecruitingProcessCandidates([]); setAllAssociatedCandidates([]); setApplicationReviewCandidates([]); return
      }
      const allIdsAll = Array.from(new Set(associations.map(a => a.candidate_id)))
      const offerIds = associations
        .filter(a => a.status !== 'rejected' && (a.status === 'offer' || (a.current_stage_id && stageMap[a.current_stage_id!]?.type === 'offer')))
        .map(a => a.candidate_id)
      const hiredIds = associations.filter(a => a.status === 'hired').map(a => a.candidate_id)
      const rejectedIds = associations.filter(a => a.status === 'rejected').map(a => a.candidate_id)
      const applicationReviewAssocs = associations
        .filter(a => 
          a.status === 'active' && 
          a.current_stage_id && 
          stageMap[a.current_stage_id]?.type === 'application_review'
        )
      const applicationReviewIds = applicationReviewAssocs.map(a => a.candidate_id)
      const fitScoreMap = new Map(applicationReviewAssocs.map(a => [a.candidate_id, a.ai_fit_score ?? null]))
      const recruitingIds = associations
        .filter(a => 
          a.status !== 'rejected' && 
          a.status !== 'hired' && 
          a.status !== 'offer' &&
          a.current_stage_id &&
          stageMap[a.current_stage_id]?.type !== 'offer' &&
          stageMap[a.current_stage_id]?.type !== 'application_review'
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
      const appReviewCands = applicationReviewIds
        .map((id) => {
          const c = byId.get(id)
          if (!c) return null
          return { ...c, ai_fit_score: fitScoreMap.get(id) ?? null }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const sa = a.ai_fit_score ?? -1
          const sb = b.ai_fit_score ?? -1
          return sb - sa
        })
      setApplicationReviewCandidates(appReviewCands)
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
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData: any) => previousData,
  })

  // AI suggested candidates hook - only load when suggested tab is active
  const { candidates: suggestedAICandidates, isLoading: isLoadingSuggested, refetch: refetchSuggested } = useJobSuggestedCandidates({
    jobId: id || '',
    enabled: !!id && pipelineSectionTab === 'suggested',
    jobSkills: job?.skills
  })

  // Keep old hook for backward compat (used by openSuggestedProfile and other references)
  const matchingCandidates = suggestedAICandidates as any[]
  const isLoadingMatches = isLoadingSuggested

  // Handle URL candidate parameter on mount and when URL changes
  useEffect(() => {
    const candidateIdFromUrl = getCandidateIdFromUrl()
    const openParam = searchParams.get('open')
    const stageParam = searchParams.get('stage')
    
    // Handle ?open=scorecard&stage=xxx parameter
    if (openParam === 'scorecard' && candidateIdFromUrl) {
      setAutoOpenScorecard(true)
      if (stageParam) {
        setAutoOpenScorecardStageId(stageParam)
      }
      // Clean up the 'open' and 'stage' params from URL
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('open')
      newParams.delete('stage')
      setSearchParams(newParams, { replace: true })
    }
    
    // Handle ?scorecard=<id> parameter (open existing scorecard by ID)
    const scorecardParam = searchParams.get('scorecard')
    if (scorecardParam && candidateIdFromUrl) {
      setAutoOpenScorecardId(scorecardParam)
    } else if (!scorecardParam) {
      setAutoOpenScorecardId(null)
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
      setAutoOpenScorecardId(null)
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
        refetchSuggested()
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
      const result = await addCandidate(candidateData)
      
      // Check if this is a duplicate that needs user confirmation
      if (result && 'isDuplicate' in result && result.isDuplicate) {
        setDuplicateInfo({
          existing: result.existingCandidate,
          incoming: result.incomingData,
          merged: result.mergedData
        })
        setShowMergeDialog(true)
        return null // Keep form open while showing dialog
      }
      
      // Refresh pipeline keys after successful creation
      setPipelineRefresh((v) => v + 1)
      setShowAddCandidate(false)
      
      // Open the candidate profile sheet
      if (result?.id) {
        updateCandidateUrl(result.id)
      }
      return result
    } catch (error) {
      console.error('Error adding candidate:', error)
      throw error
    }
  }

  const handleMergeConfirm = async () => {
    if (!duplicateInfo) return
    
    try {
      await confirmMergeCandidate(
        duplicateInfo.existing.id,
        duplicateInfo.incoming,
        duplicateInfo.incoming.assignedStageId
      )
      
      // Refresh pipeline keys after merge
      setPipelineRefresh((v) => v + 1)
      setShowMergeDialog(false)
      setDuplicateInfo(null)
      setShowAddCandidate(false)
    } catch (error) {
      console.error('Error merging candidate:', error)
    }
  }

  const handleMergeCancel = () => {
    setShowMergeDialog(false)
    setDuplicateInfo(null)
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

  if (!job) return (
    <div className="min-h-screen bg-background">
      <div className="layout-container py-6 sm:py-8 lg:py-12">
        <Skeleton className="h-12 w-64 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-background overflow-hidden pb-[calc(env(safe-area-inset-bottom,0px)+72px)] sm:pb-0">
      <div className="layout-container pt-1 pb-2 sm:pt-2 sm:pb-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        {isMobile && (
          <div className="mb-3">
            <JobDetailMobileHeader
              jobTitle={job.title}
              onMenuToggle={() => {}}
              onBackToJobs={handleBackToJobs}
            />
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full flex-1 min-h-0 flex flex-col overflow-hidden"
        >
          {(() => {
            const triggerCls = "relative h-10 px-0 rounded-none bg-transparent shadow-none font-poppins font-medium text-[14px] tracking-[-0.005em] text-text-secondary hover:text-text-primary data-[state=active]:text-text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-text-primary after:opacity-0 data-[state=active]:after:opacity-100"
            const triggers = (
              <>
                <TabsTrigger value="pipeline" className={triggerCls}>Pipeline</TabsTrigger>
                {!isRestrictedViewer && (
                  <TabsTrigger value="candidates" className={triggerCls}>Job Dashboard</TabsTrigger>
                )}
                {!isRestrictedViewer && (
                  <TabsTrigger value="job-setup" className={triggerCls}>Setup</TabsTrigger>
                )}
              </>
            )
            return !isMobile ? (
              <div className="mb-3 bg-white border border-virgilio-border rounded-2xl shadow-sm px-6 pt-5 animate-fade-in shrink-0">
                <JobHero
                  title={job.title}
                  status={job.status}
                  department={(job as any).organization_name || (job as any).organization?.name || (job as any).department || null}
                  location={job.location}
                  createdAt={job.created_at}
                  hiringTeam={(job.hiring_team as any[]) || []}
                  onShare={() => {}}
                  onViewPosting={() => {}}
                  hasPosting={hasJobPosting}
                  onAddCandidate={() => setShowAddCandidate(true)}
                  onMoreActions={() => setShowEditJobModal(true)}
                  canEdit={!isRestrictedViewer}
                />
                <TabsList className="h-auto bg-transparent p-0 shadow-none border-0 rounded-none w-full justify-start gap-6 mt-4">
                  {triggers}
                </TabsList>
              </div>
            ) : (
              <TabsList className="h-auto bg-transparent p-0 shadow-none border-0 border-b border-virgilio-border rounded-none w-full justify-start gap-6 mb-3 shrink-0">
                {triggers}
              </TabsList>
            )
          })()}


          {/* Job Dashboard */}
          {!isRestrictedViewer && (
            <TabsContent
              value="candidates"
              className="flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden mt-0"
            >
              <JobAnalyticsDashboard
                jobId={id!}
                candidates={allAssociatedCandidates.length ? allAssociatedCandidates : applicationReviewCandidates}
                jobCurrency={job.currency || 'USD'}
              />
            </TabsContent>
          )}

          {/* Setup */}
          {!isRestrictedViewer && (
            <TabsContent
              value="job-setup"
              className="flex-1 min-h-0 overflow-auto data-[state=inactive]:hidden mt-0"
            >
              <JobSetupLayout
                jobId={id!}
                jobTitle={job.title}
                job={{
                  ...job,
                  hiring_team: (job.hiring_team as any[]) || []
                }}
                onEdit={handleEditJob}
              />
            </TabsContent>
          )}

          {/* Pipeline */}
          <TabsContent
            value="pipeline"
            className="flex-1 min-h-0 overflow-hidden data-[state=inactive]:hidden mt-0"
          >
            <div className="flex h-full min-h-0 flex-col">
              {!isRestrictedViewer && (
                <div className="mb-4 shrink-0">
                  <PipelineSectionTabs
                    value={pipelineSectionTab as PipelineSection}
                    onChange={(v) => setPipelineSectionTab(v as any)}
                    counts={{
                      suggested: suggestedCount,
                      application: applicationCount,
                      recruiting: recruitingCount,
                      offers: offerCount,
                      hired: hiredCount,
                      rejected: rejectedCount,
                    }}
                  />
                </div>
              )}
              <div className="w-full flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="hidden sm:block shrink-0 mb-3">
                  <TableToolbar
                    left={
                      <>
                        <TableSearch
                          value={pipelineSearch}
                          onChange={setPipelineSearch}
                          placeholder="Search in pipeline…"
                          className="w-[280px]"
                        />
                        <Button variant="secondary" size="sm" icon={Filter}>
                          Filters
                        </Button>
                      </>
                    }
                    right={
                      <>
                        {pipelineSectionTab === 'recruiting' && (
                          <TableSegmented
                            value={pipelineView}
                            onChange={(v) => setPipelineView(v as 'board' | 'list')}
                            options={[
                              { value: 'board', label: 'Board', icon: LayoutGrid },
                              { value: 'list', label: 'List', icon: List },
                            ]}
                          />
                        )}
                        {pipelineSectionTab === 'application' && applicationCount > 0 && (
                          <Button
                            variant="purple"
                            size="sm"
                            icon={ClipboardCheck}
                            onClick={() => setShowApplicationReview(true)}
                          >
                            Review applications
                          </Button>
                        )}
                        {!selectionMode && pipelineSectionTab === 'recruiting' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={CheckSquare}
                            onClick={() => setSelectionMode(true)}
                          >
                            Select
                          </Button>
                        )}
                        {selectionMode && (
                          <>
                            {selectedCandidateIds.length > 0 && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Mail}
                                  onClick={() => setShowBulkEmailDialog(true)}
                                >
                                  Email
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => setShowBulkRejectionDialog(true)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedCandidateIds([])
                                setSelectionMode(false)
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          icon={UserPlus}
                          onClick={() => setShowAddCandidate(true)}
                          className="text-white [&_svg]:text-white"
                        >
                          Add candidate
                        </Button>
                      </>
                    }
                  />
                </div>
                <div className="p-0 flex-1 min-h-0">
                  {pipelineSectionTab === 'recruiting' && pipelineView === 'board' ? (
                    <>
                      <div className="h-full min-h-[52dvh] w-full overflow-y-auto sm:hidden p-layout-md pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
                        <PipelineOverview
                          jobId={id!}
                          showHeader={false}
                          viewMode={pipelineView}
                          onViewModeChange={setPipelineView}
                          selectionMode={selectionMode}
                          onSelectionModeChange={setSelectionMode}
                          onSelectedIdsChange={setSelectedCandidateIds}
                          refreshToken={pipelineRefresh}
                          onStageChanged={() => setPipelineRefresh((v) => v + 1)}
                          onCandidateClick={openPipelineProfile}
                          searchTerm={pipelineSearch}
                          onAddCandidateClick={() => setShowAddCandidate(true)}
                        />
                      </div>
                      <ScrollArea className="h-full w-full scrollbar-black hidden sm:block">
                        <div className="w-fit p-layout-md">
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
                          searchTerm={pipelineSearch}
                          onAddCandidateClick={() => setShowAddCandidate(true)}
                          />
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <ScrollArea className="h-full w-full scrollbar-black">
                      {pipelineSectionTab === 'recruiting' ? (
                        <div className="w-full p-layout-md">
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
                          searchTerm={pipelineSearch}
                          onAddCandidateClick={() => setShowAddCandidate(true)}
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
                              <div className="flex items-center justify-center py-12">
                                <SuggestedCandidatesLoader />
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
                                showFitScore={true}
                                hideSkills={true}
                              />
                            ) : (
                              <GioEmptyState
                                title="No matching candidates found"
                                description="Try adjusting the job requirements or add more skills"
                              />
                            )}
                          </div>
                        </div>
                      ) : pipelineSectionTab === 'application' ? (
                        <div className="w-full p-layout-md">
                          <CandidateTable
                            candidates={applicationReviewCandidates}
                            isLoading={statusListsLoading}
                            onEdit={handleEditCandidate}
                            onDelete={handleDeleteCandidate}
                            markCandidateAsViewed={markCandidateAsViewed}
                            isCandidateNewForUser={isCandidateNewForUser}
                            onRowClick={(candidateId) => openProfileInPlace(candidateId, 'application', applicationReviewCandidates)}
                            selectionMode={selectionMode}
                            onSelectionModeChange={setSelectionMode}
                            selectedIds={selectedCandidateIds}
                            onSelectedIdsChange={setSelectedCandidateIds}
                            hideSkills={true}
                            showFitScore={true}
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
                            selectionMode={selectionMode}
                            onSelectionModeChange={setSelectionMode}
                            selectedIds={selectedCandidateIds}
                            onSelectedIdsChange={setSelectedCandidateIds}
                            hideSkills={true}
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
                            hideSkills={true}
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
                            hideSkills={true}
                          />
                        </div>
                      )}
                    </ScrollArea>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
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
                setAutoOpenScorecardStageId(null)
                setAutoOpenScorecardId(null)
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
            autoOpenScorecardStageId={autoOpenScorecardStageId}
            autoOpenScorecardId={autoOpenScorecardId}
            onScorecardOpened={() => {
              setAutoOpenScorecard(false)
              setAutoOpenScorecardStageId(null)
            }}
            onScorecardChange={(scorecardId) => {
              updateScorecardUrl(scorecardId)
              if (!scorecardId) setAutoOpenScorecardId(null)
            }}
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

        {/* Candidate Merge Dialog */}
        <CandidateMergeDialog
          isOpen={showMergeDialog}
          onConfirm={handleMergeConfirm}
          onCancel={handleMergeCancel}
          existingCandidate={duplicateInfo?.existing}
          newCandidate={duplicateInfo?.incoming}
          mergedCandidate={duplicateInfo?.merged}
        />

        {/* Application Review Sheet */}
        <ApplicationReviewSheet
          open={showApplicationReview}
          onOpenChange={setShowApplicationReview}
          jobId={id!}
          jobTitle={job?.title || ''}
          onComplete={() => {
            setPipelineRefresh((v) => v + 1)
          }}
        />
      </div>
    </div>
  )
}
