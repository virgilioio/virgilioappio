import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, Plus, CheckCircle2, Loader2, MapPin, Linkedin, ChevronLeft, ChevronRight, Download, Mail, Phone, X, Info, ArrowUpDown, Sparkles, Heart } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useSourcingCreditWarnings } from '@/hooks/useSourcingCreditWarnings'
import emptyStateAvatar from '@/assets/empty-state-avatar.png'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { CandidateTableSkeleton } from './CandidateTableSkeleton'
import { JobSelectionDialog } from './JobSelectionDialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SortableHeader } from '@/components/ui/sortable-header'
import { useSortableTable } from '@/hooks/useSortableTable'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'
import { cn } from '@/lib/utils'

// Helper to safely resolve display name across PDL (full_name) and Apollo (candidate_name) candidates
const getDisplayName = (c: { full_name?: string; candidate_name?: string }) =>
  c.full_name || c.candidate_name || 'Unknown'

// Helper to safely build location string from candidate fields
const getLocation = (c: { location?: string; location_city?: string; location_state?: string; location_country?: string }) =>
  c.location || [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ') || undefined

interface MatchedCandidate {
  id: string
  candidate_name?: string
  current_role?: string
  current_company?: string
  location?: string
  location_city?: string
  location_state?: string
  location_country?: string
  linkedin_url?: string
  match_score: number
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal'
  skills?: string[]
  years_experience?: number
  experience_years?: number
  source: 'local' | 'apollo' | 'pdl'
  display_source?: 'internal' | 'gio' | 'apollo' | 'pdl'
  is_preview?: boolean
  needs_enrichment?: boolean
  is_gio_sourced?: boolean
  pdl_id?: string
  summary?: string
  profile_summary?: string | null
  full_name?: string
  apollo_id?: string
  apollo_score?: number
  headline?: string
  email?: string
  email_status?: string
  phone?: string
  candidate_id?: string | null
  industry?: string
  connections_count?: number
  follower_count?: number
  company_url?: string
  company_website?: string
  company_industry?: string
  experience_location?: string
  has_email?: boolean
  has_phone?: boolean
  has_location?: boolean
  keyword_score?: number
  matched_keywords?: string[]
  created_at?: string
}

interface SourcingCandidateTableProps {
  candidates: MatchedCandidate[]
  isLoading: boolean
  jobId?: string | null
  projectId?: string | null
  searchCriteria?: import('@/types/sourcing').SearchCriteria
  sourceBreakdown?: {
    internal?: number
    gio?: number
    pdl: number
    apollo: number
    full_data: number
    preview_only: number
  }
}

export function SourcingCandidateTable({ 
  candidates, 
  isLoading,
  jobId,
  projectId,
  searchCriteria,
  sourceBreakdown
}: SourcingCandidateTableProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const PAGE_STEP = 25
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [selectedApolloId, setSelectedApolloId] = useState<string | null>(null)
  const [selectedApolloData, setSelectedApolloData] = useState<any>(null)
  const [selectedPdlData, setSelectedPdlData] = useState<MatchedCandidate | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { isCollectDisabled } = useSourcingCreditWarnings()

  // Fit segment filter (toolbar) — All / Strong fit / Good / Possible / Collected
  type FitSegment = 'all' | 'strong' | 'good' | 'possible' | 'collected'
  const [fitSegment, setFitSegment] = useState<FitSegment>('all')
  // Sort mode (toolbar)
  type SortMode = 'ai_fit' | 'recent' | 'experience'
  const [sortMode, setSortMode] = useState<SortMode>('ai_fit')

  // Bulk selection state
  const [selectedApolloIds, setSelectedApolloIds] = useState<Set<string>>(new Set())
  const [isBulkCollecting, setIsBulkCollecting] = useState(false)
  const [showJobDialog, setShowJobDialog] = useState(false)
  const [pendingBulkIds, setPendingBulkIds] = useState<string[]>([])

  // Segment counts (computed from full candidate set, ignoring segment filter)
  const segmentCounts = {
    all: candidates.length,
    strong: candidates.filter(c => c.match_tier === 'excellent').length,
    good: candidates.filter(c => c.match_tier === 'good').length,
    possible: candidates.filter(c => c.match_tier === 'fair' || c.match_tier === 'minimal').length,
    collected: candidates.filter(c => c.source === 'apollo' && !!c.candidate_id).length,
  }

  // Apply fit segment filter
  const segmentFiltered = candidates.filter(c => {
    switch (fitSegment) {
      case 'strong': return c.match_tier === 'excellent'
      case 'good': return c.match_tier === 'good'
      case 'possible': return c.match_tier === 'fair' || c.match_tier === 'minimal'
      case 'collected': return c.source === 'apollo' && !!c.candidate_id
      default: return true
    }
  })

  // Sortable table — sort key derived from sortMode
  const sortKey = sortMode === 'ai_fit' ? 'match_score' : sortMode === 'experience' ? 'experience_years' : 'created_at'
  const { sortedData, sortConfig, requestSort } = useSortableTable(
    segmentFiltered,
    { key: sortKey as any, direction: 'desc' }
  )

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage)

  // Apollo candidates that can be selected on current page (not already collected)
  const apolloCandidatesOnPage = paginatedData.filter(c => 
    c.source === 'apollo' && !c.candidate_id && c.apollo_id
  )

  const isAllApolloSelected = apolloCandidatesOnPage.length > 0 && 
    apolloCandidatesOnPage.every(c => selectedApolloIds.has(c.apollo_id!))

  const toggleSelectApollo = (apolloId: string) => {
    setSelectedApolloIds(prev => {
      const next = new Set(prev)
      if (next.has(apolloId)) {
        next.delete(apolloId)
      } else {
        next.add(apolloId)
      }
      return next
    })
  }

  const toggleSelectAllApollo = () => {
    if (isAllApolloSelected) {
      // Deselect all on current page
      setSelectedApolloIds(prev => {
        const next = new Set(prev)
        apolloCandidatesOnPage.forEach(c => next.delete(c.apollo_id!))
        return next
      })
    } else {
      // Select all on current page
      setSelectedApolloIds(prev => {
        const next = new Set(prev)
        apolloCandidatesOnPage.forEach(c => next.add(c.apollo_id!))
        return next
      })
    }
  }

  const clearSelection = () => setSelectedApolloIds(new Set())

  // Track current candidate index for navigation
  const currentIndex = selectedApolloId 
    ? sortedData.findIndex(c => c.apollo_id === selectedApolloId)
    : selectedPdlData
    ? sortedData.findIndex(c => c.id === selectedPdlData.id)
    : sortedData.findIndex(c => c.id === selectedCandidateId)
  
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < sortedData.length - 1

  // Navigation handlers
  const handleNavigatePrev = () => {
    if (currentIndex > 0) {
      const prevCandidate = sortedData[currentIndex - 1]
      
      if (isPdlCandidate(prevCandidate)) {
        setSelectedPdlData(prevCandidate)
        setSelectedCandidateId(null)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
      } else if (prevCandidate.candidate_id || prevCandidate.source === 'local') {
        setSelectedCandidateId(prevCandidate.id)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
        setSelectedPdlData(null)
      } else if (prevCandidate.source === 'apollo' && prevCandidate.apollo_id) {
        setSelectedCandidateId(null)
        setSelectedPdlData(null)
        setSelectedApolloId(prevCandidate.apollo_id)
        setSelectedApolloData({
          candidate_name: getDisplayName(prevCandidate),
          headline: prevCandidate.headline,
          location: getLocation(prevCandidate),
          current_company: prevCandidate.current_company,
          current_role: prevCandidate.current_role,
          linkedin_url: prevCandidate.linkedin_url,
          apollo_score: prevCandidate.apollo_score,
          email: prevCandidate.email,
          phone: prevCandidate.phone,
          industry: prevCandidate.industry,
          connections_count: prevCandidate.connections_count,
          follower_count: prevCandidate.follower_count,
          company_url: prevCandidate.company_url,
          company_website: prevCandidate.company_website,
          company_industry: prevCandidate.company_industry,
          experience_location: prevCandidate.experience_location,
          has_email: prevCandidate.has_email,
          has_phone: prevCandidate.has_phone,
          has_location: prevCandidate.has_location
        })
      }
      
      // Update pagination if needed
      const prevPage = Math.floor((currentIndex - 1) / itemsPerPage) + 1
      if (prevPage !== currentPage) {
        setCurrentPage(prevPage)
      }
    }
  }

  const handleNavigateNext = () => {
    if (currentIndex < sortedData.length - 1) {
      const nextCandidate = sortedData[currentIndex + 1]
      
      if (isPdlCandidate(nextCandidate)) {
        setSelectedPdlData(nextCandidate)
        setSelectedCandidateId(null)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
      } else if (nextCandidate.candidate_id || nextCandidate.source === 'local') {
        setSelectedCandidateId(nextCandidate.id)
        setSelectedApolloId(null)
        setSelectedApolloData(null)
        setSelectedPdlData(null)
      } else if (nextCandidate.source === 'apollo' && nextCandidate.apollo_id) {
        setSelectedCandidateId(null)
        setSelectedPdlData(null)
        setSelectedApolloId(nextCandidate.apollo_id)
        setSelectedApolloData({
          candidate_name: getDisplayName(nextCandidate),
          headline: nextCandidate.headline,
          location: getLocation(nextCandidate),
          current_company: nextCandidate.current_company,
          current_role: nextCandidate.current_role,
          linkedin_url: nextCandidate.linkedin_url,
          apollo_score: nextCandidate.apollo_score,
          email: nextCandidate.email,
          phone: nextCandidate.phone,
          industry: nextCandidate.industry,
          connections_count: nextCandidate.connections_count,
          follower_count: nextCandidate.follower_count,
          company_url: nextCandidate.company_url,
          company_website: nextCandidate.company_website,
          company_industry: nextCandidate.company_industry,
          experience_location: nextCandidate.experience_location,
          has_email: nextCandidate.has_email,
          has_phone: nextCandidate.has_phone,
          has_location: nextCandidate.has_location
        })
      }
      
      // Update pagination if needed
      const nextPage = Math.floor((currentIndex + 1) / itemsPerPage) + 1
      if (nextPage !== currentPage) {
        setCurrentPage(nextPage)
      }
    }
  }

  // Track which candidates are already in pipeline
  const [addedCandidates, setAddedCandidates] = useState<Set<string>>(new Set())
  const [loadingCandidates, setLoadingCandidates] = useState<Set<string>>(new Set())
  const [collectingProfiles, setCollectingProfiles] = useState<Set<string>>(new Set())
  // Track apollo IDs that have been collected in this session
  const [collectedApolloIds, setCollectedApolloIds] = useState<Set<string>>(new Set())

  // Handler for when a candidate is collected from the sheet
  const handleCandidateCollected = (candidateId: string, apolloId: string) => {
    setCollectedApolloIds(prev => new Set(prev).add(apolloId))
    setAddedCandidates(prev => new Set(prev).add(candidateId))
  }

  // Check existing pipeline candidates
  useEffect(() => {
    if (!jobId || candidates.length === 0) return

    const checkExisting = async () => {
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .eq('job_id', jobId)
        .in('candidate_id', candidates.map(c => c.id))

      if (data) {
        setAddedCandidates(new Set(data.map(d => d.candidate_id)))
      }
    }

    checkExisting()
  }, [jobId, candidates])

  // Bulk collect handler
  const handleBulkCollect = async () => {
    if (selectedApolloIds.size === 0) return
    
    const idsToCollect = Array.from(selectedApolloIds)
    
    // If no job linked, show job selection dialog
    if (!jobId) {
      setPendingBulkIds(idsToCollect)
      setShowJobDialog(true)
      return
    }
    
    // Proceed with bulk collection
    await executeBulkCollect(idsToCollect, jobId)
  }

  const executeBulkCollect = async (apolloIds: string[], targetJobId?: string | null, stageId?: string) => {
    setIsBulkCollecting(true)
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: {
          apollo_ids: apolloIds,
          job_id: targetJobId,
          stage_id: stageId,
          sourcing_project_id: projectId,
          user_id: user?.id
        }
      })
      
      if (error) {
        if (error.message?.includes('CREDITS_EXHAUSTED')) {
          throw new Error('Monthly collect credit limit reached.')
        }
        throw error
      }
      
      const successCount = data?.enriched_count || 0
      const alreadyCollected = data?.results?.filter((r: any) => r.already_collected).length || 0
      
      toast({
        title: 'Profiles collected',
        description: `${successCount} new profile(s) collected.${alreadyCollected > 0 ? ` ${alreadyCollected} were already in your database.` : ''}`
      })
      
      // Immediately mark all as collected for instant badge display
      setCollectedApolloIds(prev => {
        const next = new Set(prev)
        apolloIds.forEach(id => next.add(id))
        return next
      })
      
      clearSelection()
      // Invalidate queries to refresh data without full page reload
      queryClient.invalidateQueries({ queryKey: ['sourcing-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
    } catch (error: any) {
      toast({
        title: 'Failed to collect profiles',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setIsBulkCollecting(false)
    }
  }

  const handleCollectProfile = async (apolloId: string) => {
    if (!jobId) {
      toast({
        title: 'No job linked',
        description: 'Cannot collect profile without a job context.',
        variant: 'destructive'
      })
      return
    }

    if (isCollectDisabled) {
      toast({
        title: 'Monthly collect limit reached',
        description: 'You have exhausted your collect credits for this month. Credits will reset on the 1st of next month.',
        variant: 'destructive',
        duration: 8000
      })
      return
    }

    setCollectingProfiles(prev => new Set(prev).add(apolloId))

    try {
      const { data: { user } } = await supabase.auth.getUser()

      const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
        body: {
          apollo_id: apolloId,
          job_id: jobId,
          sourcing_project_id: projectId,
          user_id: user?.id
        }
      })

      if (error) {
        // Handle credit exhaustion error specifically
        if (error.message?.includes('CREDITS_EXHAUSTED')) {
          throw new Error('Monthly collect credit limit reached. Credits will reset on the 1st of next month.')
        }
        throw error
      }

      toast({
        title: 'Profile collected',
        description: 'Full candidate profile has been added to your pipeline.'
      })

      // Immediately mark as collected for instant badge display
      setCollectedApolloIds(prev => new Set(prev).add(apolloId))

      // Invalidate queries to refresh data without full page reload
      queryClient.invalidateQueries({ queryKey: ['sourcing-candidates', projectId] })
      queryClient.invalidateQueries({ queryKey: ['saved-candidates', projectId] })
    } catch (error: any) {
      toast({
        title: 'Failed to collect profile',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setCollectingProfiles(prev => {
        const next = new Set(prev)
        next.delete(apolloId)
        return next
      })
    }
  }

  const handleAddToPipeline = async (candidate: MatchedCandidate, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    if (!jobId) {
      toast({
        title: 'No job linked',
        description: 'This project is not linked to a job yet.',
        variant: 'destructive'
      })
      return
    }

    setLoadingCandidates(prev => new Set(prev).add(candidate.id))

    try {
      let candidateDbId = candidate.id

      // PDL candidates are in-memory only — upsert into candidates table first
      if (isPdlCandidate(candidate) && !candidate.candidate_id) {
        const { data: { user } } = await supabase.auth.getUser()
        
        // Get org id from user profile
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client: any = supabase
        const { data: profile } = await client
          .from('profiles')
          .select('organization_id')
          .eq('id', user!.id)
          .single()

        if (!profile?.organization_id) throw new Error('No organization found')

        const insertData = {
          candidate_name: candidate.full_name || candidate.candidate_name || 'Unknown',
          email: candidate.email || null,
          phone: candidate.phone || null,
          linkedin_url: candidate.linkedin_url || null,
          current_job_title: candidate.current_role || null,
          company_current: candidate.current_company || null,
          location_city: candidate.location_city || null,
          location_state: candidate.location_state || null,
          location_country: candidate.location_country || null,
          profile_summary: candidate.summary || candidate.profile_summary || null,
          skills: candidate.skills || null,
          years_experience: candidate.years_experience || candidate.experience_years || null,
          source: 'pdl' as const,
          organization_id: profile.organization_id,
          created_by: user!.id,
        }

        const { data: newCandidate, error: insertError } = await supabase
          .from('candidates')
          .insert(insertData)
          .select('id')
          .single()

        if (insertError) throw insertError
        candidateDbId = newCandidate.id
      }

      const { error } = await supabase
        .from('job_candidate_associations')
        .insert({
          job_id: jobId,
          candidate_id: candidateDbId,
          stage: 'sourced'
        })

      if (error) throw error

      setAddedCandidates(prev => new Set(prev).add(candidate.id))
      toast({
        title: 'Added to pipeline',
        description: `${getDisplayName(candidate)} has been added.`
      })
    } catch (error: any) {
      toast({
        title: 'Failed to add candidate',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setLoadingCandidates(prev => {
        const next = new Set(prev)
        next.delete(candidate.id)
        return next
      })
    }
  }

  // Unified display source helper — trusts backend `display_source`, falls back to legacy flags
  const getDisplaySource = (c: MatchedCandidate): 'internal' | 'gio' | 'apollo' | 'pdl' =>
    c.display_source ||
    (c.source === 'apollo' && c.is_preview === false && !!c.candidate_id && !c.is_gio_sourced ? 'internal' :
     c.is_gio_sourced ? 'gio' :
     c.source === 'pdl' ? 'pdl' : 'apollo')

  // Legacy helpers now derived from getDisplaySource
  const isCollectedApollo = (c: MatchedCandidate) => getDisplaySource(c) === 'internal'
  const isGioSourced = (c: MatchedCandidate) => getDisplaySource(c) === 'gio'
  const isPdlCandidate = (c: MatchedCandidate) => getDisplaySource(c) === 'pdl'
  const isApolloPreview = (c: MatchedCandidate) => getDisplaySource(c) === 'apollo'

  const getMatchBadgeColor = (tier: string) => {
    switch (tier) {
      case 'excellent': return 'bg-green-500 text-white hover:bg-green-600'
      case 'good': return 'bg-blue-500 text-white hover:bg-blue-600'
      case 'fair': return 'bg-yellow-500 text-white hover:bg-yellow-600'
      case 'minimal': return 'bg-orange-500 text-white hover:bg-orange-600'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  if (isLoading) {
    return <CandidateTableSkeleton rows={8} />
  }

  if (candidates.length === 0) {
    return (
      <Card className="shadow-calendly">
        <CardContent className="p-12 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <img 
                src={emptyStateAvatar} 
                alt="No candidates found"
                className="h-24 w-24 rounded-full"
              />
            </div>
            <h3 className="text-lg font-semibold">No candidates found</h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your search criteria or filters
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-hidden">

      {/* Toolbar / Bulk Action Bar — mutually exclusive */}
      {selectedApolloIds.size > 0 ? (
        // Dark bulk action bar
        <div className="sticky top-0 z-10 rounded-lg bg-[#0d0d09] px-4 py-2.5 flex items-center justify-between shadow-[0_8px_24px_-12px_rgba(0,0,0,0.4)] shrink-0">
          <div className="flex items-center gap-3 text-white">
            <span className="font-poppins text-[13px] font-medium tabular-nums inline-flex items-center">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/15 px-1.5 text-xs text-white">
                {selectedApolloIds.size}
              </span>
              <span className="ml-2 text-white">selected</span>
            </span>
            <span className="text-white/30">·</span>
            <button
              type="button"
              onClick={() => {
                const all = new Set(selectedApolloIds)
                sortedData.forEach(c => {
                  if (c.source === 'apollo' && !c.candidate_id && c.apollo_id) all.add(c.apollo_id)
                })
                setSelectedApolloIds(all)
              }}
              className="text-[12.5px] text-white/80 hover:text-white underline-offset-2 hover:underline"
            >
              Select all {sortedData.filter(c => c.source === 'apollo' && !c.candidate_id && c.apollo_id).length}
            </button>
            <span className="text-white/30">·</span>
            <button
              type="button"
              onClick={clearSelection}
              className="text-[12.5px] text-white/60 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="purple"
              icon={isBulkCollecting ? undefined : Download}
              onClick={handleBulkCollect}
              disabled={isBulkCollecting || isCollectDisabled}
            >
              {isBulkCollecting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {isCollectDisabled
                ? 'Credits exhausted'
                : `Collect ${selectedApolloIds.size} · ${selectedApolloIds.size} credit${selectedApolloIds.size === 1 ? '' : 's'}`}
            </Button>
            <Button size="sm" variant="secondary" onDark icon={Heart}>
              Save for later
            </Button>
            <Button size="sm" variant="ghost" onDark>
              Not a fit
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onDark
              iconOnly
              icon={X}
              aria-label="Clear selection"
              onClick={clearSelection}
            />
          </div>
        </div>
      ) : (
        // Results toolbar
        <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left: count */}
          <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
            <span>
              Showing{' '}
              <span className="font-medium text-text-primary tabular-nums">
                {sortedData.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + itemsPerPage, sortedData.length)}
              </span>{' '}
              of <span className="font-medium text-text-primary tabular-nums">{sortedData.length}</span>
            </span>
          </div>

          {/* Center: fit segments */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#F1F0EC] p-0.5">
            {([
              { id: 'all', label: 'All', count: segmentCounts.all },
              { id: 'strong', label: 'Strong fit', count: segmentCounts.strong },
              { id: 'good', label: 'Good', count: segmentCounts.good },
              { id: 'possible', label: 'Possible', count: segmentCounts.possible },
              { id: 'collected', label: 'Collected', count: segmentCounts.collected },
            ] as const).map(seg => (
              <button
                key={seg.id}
                type="button"
                onClick={() => { setFitSegment(seg.id); setCurrentPage(1) }}
                className={cn(
                  'h-7 px-2.5 rounded-md font-poppins text-[12px] font-medium tracking-[-0.005em] transition-colors',
                  'inline-flex items-center gap-1.5',
                  fitSegment === seg.id
                    ? 'bg-white text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <span>{seg.label}</span>
                <span className={cn(
                  'text-[11px] tabular-nums',
                  fitSegment === seg.id ? 'text-text-tertiary' : 'text-text-tertiary/70'
                )}>
                  {seg.count}
                </span>
              </button>
            ))}
          </div>

          {/* Right: sort + select all */}
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" icon={ArrowUpDown} dropdown>
                  Sort: {sortMode === 'ai_fit' ? 'AI fit' : sortMode === 'recent' ? 'Recent activity' : 'Experience'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8}>
                <DropdownMenuItem onSelect={() => setSortMode('ai_fit')}>AI fit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode('recent')}>Recent activity</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode('experience')}>Experience</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              icon={CheckCircle2}
              onClick={toggleSelectAllApollo}
              disabled={apolloCandidatesOnPage.length === 0}
            >
              Select all
            </Button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <Card className="shadow-calendly hidden md:flex flex-1 min-h-0 flex-col overflow-hidden">
        <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Table>
            <TableBody>
              {paginatedData.map((candidate, pIdx) => {
                const isAdded = addedCandidates.has(candidate.id)
                const isLoading = loadingCandidates.has(candidate.id)
                const isCollecting = candidate.apollo_id ? collectingProfiles.has(candidate.apollo_id) : false
                const isPdl = isPdlCandidate(candidate)
                const canSelect = !isPdl && candidate.source === 'apollo' && !candidate.candidate_id && candidate.apollo_id
                const isSelected = canSelect && selectedApolloIds.has(candidate.apollo_id!)

                // Check if this row is currently open in the preview
                const isActiveRow = sheetOpen && (
                  (selectedCandidateId && candidate.id === selectedCandidateId) ||
                  (selectedApolloId && candidate.apollo_id === selectedApolloId) ||
                  (selectedPdlData && candidate.id === selectedPdlData.id)
                )

                // Determine candidate type for unified rendering
                const isInternal = isCollectedApollo(candidate)
                const isGio = isGioSourced(candidate)
                const isApollo = !isInternal && !isGio && candidate.source === 'apollo' && !candidate.candidate_id
                const location = getLocation(candidate)

                // Badge config per type
                const badgeClass = isInternal ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isGio ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : isPdl ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                const badgeLabel = isInternal ? 'Internal' : isGio ? 'Gio' : isPdl ? 'PDL' : 'Apollo'

                // Click handler per type
                const handleRowClick = () => {
                  if (isInternal) {
                    setSelectedCandidateId(candidate.candidate_id || candidate.id)
                    setSelectedApolloId(null)
                    setSelectedApolloData(null)
                    setSelectedPdlData(null)
                    setSheetOpen(true)
                  } else if (isPdl) {
                    setSelectedPdlData(candidate)
                    setSelectedCandidateId(null)
                    setSelectedApolloId(null)
                    setSelectedApolloData(null)
                    setSheetOpen(true)
                  } else if (isGio) {
                    // Gio candidates have rich data — open PDL-style sheet
                    setSelectedPdlData(candidate)
                    setSelectedCandidateId(null)
                    setSelectedApolloId(null)
                    setSelectedApolloData(null)
                    setSheetOpen(true)
                  } else if (candidate.source === 'apollo' && candidate.apollo_id) {
                    // Apollo candidates open as Apollo preview
                    setSelectedCandidateId(null)
                    setSelectedApolloId(candidate.apollo_id || null)
                    setSelectedApolloData(candidate)
                    setSelectedPdlData(null)
                    setSheetOpen(true)
                  } else if (candidate.candidate_id || candidate.source === 'local') {
                    setSelectedCandidateId(candidate.candidate_id || candidate.id)
                    setSelectedApolloId(null)
                    setSelectedApolloData(null)
                    setSelectedPdlData(null)
                    setSheetOpen(true)
                  } else if (candidate.source === 'apollo' && candidate.apollo_id) {
                    setSelectedCandidateId(null)
                    setSelectedApolloId(candidate.apollo_id)
                    setSelectedApolloData({
                      candidate_name: getDisplayName(candidate),
                      headline: candidate.headline,
                      location: getLocation(candidate),
                      current_company: candidate.current_company,
                      current_role: candidate.current_role,
                      linkedin_url: candidate.linkedin_url,
                      apollo_score: candidate.apollo_score,
                      email: candidate.email,
                      phone: candidate.phone,
                      industry: candidate.industry,
                      connections_count: candidate.connections_count,
                      follower_count: candidate.follower_count,
                      company_url: candidate.company_url,
                      company_website: candidate.company_website,
                      company_industry: candidate.company_industry,
                      experience_location: candidate.experience_location,
                      has_email: candidate.has_email,
                      has_phone: candidate.has_phone,
                      has_location: candidate.has_location
                    })
                    setSelectedPdlData(null)
                    setSheetOpen(true)
                  }
                }

                // Fit score band → tone for right rail
                const fitScore = candidate.match_score ?? 0
                const fitBand =
                  fitScore >= 85 ? { label: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200' } :
                  fitScore >= 70 ? { label: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200' } :
                  fitScore >= 55 ? { label: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200' } :
                  { label: 'text-text-tertiary', bg: 'bg-[#F1F0EC]', ring: 'ring-border' }

                // Initials for avatar
                const displayName = getDisplayName(candidate)
                const initials = displayName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map(s => s[0])
                  .join('')
                  .toUpperCase()

                // Top match: position 0 in sorted data when sorted by AI fit
                const isTopMatch = sortMode === 'ai_fit' && sortedData[0]?.id === candidate.id

                // Matched skills (green check chips)
                const matchedSkills = (candidate.matched_keywords ?? []).slice(0, 4)
                const extraSkills = (candidate.skills ?? [])
                  .filter(s => !matchedSkills.includes(s))
                  .slice(0, Math.max(0, 5 - matchedSkills.length))

                return (
                  <TableRow
                    key={`${candidate.apollo_id || candidate.id}-${pIdx}`}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border/60",
                      "hover:bg-[#FAFAF7]",
                      isSelected && "bg-[#FAF8FF]",
                      isActiveRow && "bg-[#FAF8FF] border-l-2 border-l-virgilio-purple"
                    )}
                    onClick={handleRowClick}
                  >
                    <TableCell colSpan={5} className="py-4 px-5">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                          {canSelect ? (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectApollo(candidate.apollo_id!)}
                              aria-label={`Select ${displayName}`}
                            />
                          ) : (
                            <div className="w-4 h-4" />
                          )}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border bg-virgilio-purple/10 text-virgilio-purple">
                          <AvatarFallback className="bg-virgilio-purple/10 text-virgilio-purple font-poppins text-[12px] font-semibold tracking-[-0.01em]">
                            {initials || '?'}
                          </AvatarFallback>
                        </Avatar>

                        {/* Identity block */}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* Name + tag row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary">
                              {displayName}
                            </span>
                            {isTopMatch && (
                              <Badge tone="purple" size="xs" icon={Sparkles}>Top match</Badge>
                            )}
                            {isInternal && (
                              <Badge tone="green" size="xs">Collected</Badge>
                            )}
                            {isGio && (
                              <Badge tone="purple" size="xs">Gio</Badge>
                            )}
                            {!isInternal && !isGio && isApollo && (
                              <Badge tone="neutral" size="xs">Preview</Badge>
                            )}
                            {isPdl && (
                              <Badge tone="blue" size="xs">LinkedIn</Badge>
                            )}
                            {candidate.linkedin_url && (
                              <a
                                href={candidate.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#0A66C2] hover:opacity-80"
                                aria-label="LinkedIn"
                              >
                                <Linkedin className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>

                          {/* Headline / role at company */}
                          {(candidate.current_role || candidate.current_company) && (
                            <p className="text-[12.5px] text-text-secondary truncate">
                              {candidate.current_role}
                              {candidate.current_role && candidate.current_company && ' at '}
                              {candidate.current_company && (
                                <span className="text-text-primary font-medium">{candidate.current_company}</span>
                              )}
                            </p>
                          )}

                          {/* Metadata line */}
                          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px] text-text-tertiary">
                            {((isInternal || isPdl || isGio) && location) ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />{location}
                              </span>
                            ) : isApollo && candidate.has_location ? (
                              <span className="inline-flex items-center gap-1 italic">
                                <MapPin className="h-3 w-3" />Location
                              </span>
                            ) : null}
                            {(candidate.years_experience || candidate.experience_years) ? (
                              <span>{candidate.years_experience || candidate.experience_years}y exp.</span>
                            ) : null}
                            {((isInternal || isPdl) && candidate.email) ? (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />{candidate.email}
                              </span>
                            ) : isApollo && candidate.has_email ? (
                              <span className="inline-flex items-center gap-1 italic">
                                <Mail className="h-3 w-3" />Email available
                              </span>
                            ) : null}
                            {((isInternal || isPdl) && candidate.phone) ? (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />{candidate.phone}
                              </span>
                            ) : isApollo && candidate.has_phone ? (
                              <span className="inline-flex items-center gap-1 italic">
                                <Phone className="h-3 w-3" />Phone available
                              </span>
                            ) : null}
                          </div>

                          {/* Matched + extra skill chips */}
                          {(matchedSkills.length > 0 || extraSkills.length > 0) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {matchedSkills.map(skill => (
                                <span
                                  key={`m-${skill}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-1.5 h-[18px] text-[10.5px] font-medium ring-1 ring-emerald-200/60"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  {skill}
                                </span>
                              ))}
                              {extraSkills.map(skill => (
                                <span
                                  key={`x-${skill}`}
                                  className="inline-flex items-center rounded-md bg-[#F1F0EC] text-text-secondary px-1.5 h-[18px] text-[10.5px] font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 pt-2" onClick={(e) => e.stopPropagation()}>
                            {isApollo ? (
                              <Button
                                size="sm"
                                variant="primary"
                                icon={isCollecting ? undefined : Download}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCollectProfile(candidate.apollo_id!)
                                }}
                                disabled={isCollecting || isCollectDisabled}
                                title={isCollectDisabled ? 'Monthly collect credit limit reached' : 'Reveal full profile (1 credit)'}
                              >
                                {isCollecting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {isCollectDisabled ? 'Credits exhausted' : 'Collect · 1 credit'}
                              </Button>
                            ) : isAdded ? (
                              <Button size="sm" variant="secondary" disabled icon={CheckCircle2}>
                                Added to pipeline
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="primary"
                                icon={isLoading ? undefined : Plus}
                                onClick={(e) => handleAddToPipeline(candidate, e)}
                                disabled={isLoading || !jobId}
                              >
                                {isLoading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {jobId ? 'Add to job' : 'Link a job first'}
                              </Button>
                            )}
                            <Button size="sm" variant="secondary" icon={Mail}>
                              Reach out
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              iconRight={ChevronRight}
                              onClick={(e) => { e.stopPropagation(); handleRowClick() }}
                            >
                              View profile
                            </Button>
                          </div>
                        </div>

                        {/* Right rail: AI FIT score */}
                        <div
                          className={cn(
                            "shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-lg ring-1 px-3 py-2 min-w-[64px]",
                            fitBand.bg,
                            fitBand.ring
                          )}
                        >
                          <span className="font-poppins text-[9px] uppercase tracking-[0.08em] text-text-tertiary">
                            AI Fit
                          </span>
                          <span className={cn("font-poppins text-[22px] font-semibold leading-none tabular-nums tracking-[-0.02em]", fitBand.label)}>
                            {fitScore}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end px-6 py-4 border-t border-border flex-shrink-0 bg-background">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {paginatedData.map((candidate, pIdx) => {
          const isAdded = addedCandidates.has(candidate.id)
          const isLoading = loadingCandidates.has(candidate.id)
          const isPdl = isPdlCandidate(candidate)
          const canSelect = !isPdl && candidate.source === 'apollo' && !candidate.candidate_id && candidate.apollo_id
          const isSelected = canSelect && selectedApolloIds.has(candidate.apollo_id!)

          const isInternal = isCollectedApollo(candidate)
          const isGio = isGioSourced(candidate)
          const isApollo = !isInternal && !isGio && candidate.source === 'apollo' && !candidate.candidate_id
          const location = getLocation(candidate)
          const badgeClass = isInternal ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : isGio ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' : isPdl ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
          const badgeLabel = isInternal ? 'Internal' : isGio ? 'Gio' : isPdl ? 'PDL' : 'Apollo'

          const handleCardClick = () => {
            if (isInternal) {
              setSelectedCandidateId(candidate.candidate_id || candidate.id)
              setSelectedApolloId(null)
              setSelectedApolloData(null)
              setSelectedPdlData(null)
              setSheetOpen(true)
            } else if (isPdl) {
              setSelectedPdlData(candidate)
              setSelectedCandidateId(null)
              setSelectedApolloId(null)
              setSelectedApolloData(null)
              setSheetOpen(true)
            } else if (isGio || (candidate.source === 'apollo' && candidate.apollo_id)) {
              setSelectedCandidateId(null)
              setSelectedApolloId(candidate.apollo_id || null)
              setSelectedApolloData(candidate)
              setSelectedPdlData(null)
              setSheetOpen(true)
            } else if (candidate.candidate_id || candidate.source === 'local') {
              setSelectedCandidateId(candidate.candidate_id || candidate.id)
              setSelectedApolloId(null)
              setSelectedApolloData(null)
              setSelectedApolloData({
                candidate_name: getDisplayName(candidate),
                headline: candidate.headline,
                location: getLocation(candidate),
                current_company: candidate.current_company,
                current_role: candidate.current_role,
                linkedin_url: candidate.linkedin_url,
                apollo_score: candidate.apollo_score,
                email: candidate.email,
                phone: candidate.phone,
                industry: candidate.industry,
                connections_count: candidate.connections_count,
                follower_count: candidate.follower_count,
                company_url: candidate.company_url,
                company_website: candidate.company_website,
                company_industry: candidate.company_industry,
                experience_location: candidate.experience_location,
                has_email: candidate.has_email,
                has_phone: candidate.has_phone,
                has_location: candidate.has_location
              })
              setSelectedPdlData(null)
              setSheetOpen(true)
            }
          }

          return (
            <Card
              key={`${candidate.apollo_id || candidate.id}-${pIdx}`}
              className={cn(
                "shadow-calendly cursor-pointer hover:shadow-lg transition-shadow",
                isSelected && "ring-2 ring-primary"
              )}
              onClick={handleCardClick}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {canSelect && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectApollo(candidate.apollo_id!)}
                          aria-label={`Select ${getDisplayName(candidate)}`}
                        />
                      </div>
                    )}
                    <Badge className={cn("text-[10px] px-1.5 py-0 h-4 border-0", badgeClass)}>
                      {badgeLabel}
                    </Badge>
                  </div>
                  <Badge className={cn("text-xs", getMatchBadgeColor(candidate.match_tier))}>
                    {candidate.match_score}%
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{getDisplayName(candidate)}</h3>
                  {candidate.linkedin_url && (
                    <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:text-blue-700">
                      <Linkedin className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {(candidate.current_role || candidate.current_company) && (
                  <p className="text-xs text-muted-foreground">
                    {candidate.current_role}{candidate.current_role && candidate.current_company && ' at '}{candidate.current_company}
                  </p>
                )}
                {/* Metadata chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(isInternal || isPdl) && location ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <MapPin className="h-2.5 w-2.5" />{location}
                    </span>
                  ) : isApollo && candidate.has_location ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <MapPin className="h-2.5 w-2.5" />Location
                    </span>
                  ) : null}
                  {(isInternal || isPdl) && candidate.email ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <Mail className="h-2.5 w-2.5" />{candidate.email}
                    </span>
                  ) : isApollo && candidate.has_email ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <Mail className="h-2.5 w-2.5" />Email
                    </span>
                  ) : null}
                  {(isInternal || isPdl) && candidate.phone ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <Phone className="h-2.5 w-2.5" />{candidate.phone}
                    </span>
                  ) : isApollo && candidate.has_phone ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                      <Phone className="h-2.5 w-2.5" />Phone
                    </span>
                  ) : null}
                </div>
                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                  {isApollo ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCollectProfile(candidate.apollo_id!)
                      }}
                      disabled={collectingProfiles.has(candidate.apollo_id || '') || isCollectDisabled}
                    >
                      {collectingProfiles.has(candidate.apollo_id || '') ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      Reveal (1 credit)
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); handleCardClick() }}>
                        <Eye className="h-3 w-3 mr-1" />View
                      </Button>
                      {isAdded ? (
                        <Button size="sm" variant="secondary" className="flex-1" disabled>
                          <CheckCircle2 className="h-3 w-3 mr-1" />Added
                        </Button>
                      ) : (
                        <Button size="sm" variant="default" className="flex-1" onClick={(e) => handleAddToPipeline(candidate, e)} disabled={isLoading || !jobId}>
                          {isLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                          Add
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Universal Candidate Profile Sheet */}
      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setSelectedPdlData(null)
        }}
        candidateId={selectedCandidateId}
        apolloId={selectedApolloId}
        apolloData={selectedApolloData}
        pdlData={selectedPdlData as any}
        onPdlAddToPipeline={selectedPdlData ? () => handleAddToPipeline(selectedPdlData) : undefined}
        isPdlAdding={selectedPdlData ? loadingCandidates.has(selectedPdlData.id) : false}
        isPdlAdded={selectedPdlData ? addedCandidates.has(selectedPdlData.id) : false}
        jobId={jobId}
        context="sourcing"
        hasPrev={hasPrev}
        hasNext={hasNext}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        searchCriteria={searchCriteria}
        onCandidateCollected={handleCandidateCollected}
      />

      {/* Job Selection Dialog for bulk collection without linked job */}
      <JobSelectionDialog
        open={showJobDialog}
        onOpenChange={setShowJobDialog}
        onJobSelected={async (selectedJobId, jobName, stageId) => {
          setShowJobDialog(false)
          await executeBulkCollect(pendingBulkIds, selectedJobId, stageId)
        }}
        onSkip={async () => {
          setShowJobDialog(false)
          await executeBulkCollect(pendingBulkIds, null)
        }}
        initialJobId={null}
      />
    </div>
  )
}
