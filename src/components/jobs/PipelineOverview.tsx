
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import CandidateCard from './CandidateCard'
import { usePipelineActions, PipelineAssociation } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import DraggableCandidateCard from './DraggableCandidateCard'
import DroppableStage from './DroppableStage'
import CandidateProfileSheet from '@/components/candidates/CandidateProfileSheet'
import { Button } from '@/components/ui/button'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { MobileFilterDrawer } from '@/components/ui/mobile-filter-drawer'
import { LayoutGrid, List, Zap } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { useSortableTable } from '@/hooks/useSortableTable'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { GioEmptyState } from '@/components/ui/GioEmptyState'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExternalLink } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { usePipelineCandidateStatuses } from '@/hooks/usePipelineCandidateStatuses'


interface PipelineOverviewProps {
  jobId: string
  showHeader?: boolean
  externalScroll?: boolean
  viewMode?: 'board' | 'list'
  onViewModeChange?: (mode: 'board' | 'list') => void
  selectionMode?: boolean
  onSelectionModeChange?: (mode: boolean) => void
  onSelectedIdsChange?: (ids: string[]) => void
  refreshToken?: number
  onStageChanged?: () => void
  /** When true, includes the application_review stage in the board (used in Pipeline page) */
  includeApplicationReview?: boolean
  /** Called when a candidate is clicked. Second arg is the visual navigation order snapshot */
  onCandidateClick?: (candidateId: string, navigationOrder: string[]) => void
}


const stageTypeVariants: Record<string, import('@/components/ui/badge').BadgeProps['variant']> = {
  application: 'pastel-blue',
  application_review: 'pastel-purple',
  screening: 'info',
  interview: 'pastel-purple',
  assessment: 'warning',
  reference_check: 'pastel-orange',
  offer: 'success',
  onboarding: 'pastel-green',
  custom: 'secondary',
}


const isLastPriorityStage = (stage: JobStage) => {
  const p = stage.stage_priority as any
  return p === 'last' || p === 99 || p === '99' || p === 999 || p === '999'
}

export function PipelineOverview({ jobId, showHeader = true, externalScroll = false, viewMode: controlledView, onViewModeChange, selectionMode: controlledSelectionMode, onSelectionModeChange, onSelectedIdsChange, refreshToken, onStageChanged, includeApplicationReview = false, onCandidateClick }: PipelineOverviewProps) {
  const { loadHiringPlanInstances, isLoadingPlan } = useJobHiringPlan()
  const { fetchAssociationsForJob, moveAssociationToStage, updateAssociationStatus } = usePipelineActions()

  // Query all automations for this job's stages
  const { data: allAutomations } = useQuery({
    queryKey: ['job-stage-automations', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_automations')
        .select(`
          id,
          job_hiring_stage_id,
          is_active
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!jobId
  });

  // Map of jhsId -> has active automation
  const stageHasAutomation = useMemo(() => {
    const map = new Map<string, boolean>();
    if (allAutomations) {
      allAutomations.forEach(automation => {
        map.set(automation.job_hiring_stage_id, true);
      });
    }
    return map;
  }, [allAutomations]);

  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: JobStage; position: number }[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const hasRenderedOnce = useRef(false)
  const [byStage, setByStage] = useState<Record<string, PipelineAssociation[]>>({})
  const [rejected, setRejected] = useState<PipelineAssociation[]>([])
  const [hired, setHired] = useState<PipelineAssociation[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  
  // Snapshot of navigation order when sheet opens - prevents order changes mid-session
  const [navigationSnapshot, setNavigationSnapshot] = useState<string[]>([])
  const navigationSnapshotRef = useRef<string[]>([])

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 10 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  const sensors = useSensors(mouseSensor, touchSensor)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [internalViewMode, setInternalViewMode] = useState<'board' | 'list'>('board')
  const [favoriteFilter, setFavoriteFilter] = useState<string[]>([])
  const currentView = controlledView ?? internalViewMode
  const setCurrentView = onViewModeChange ?? setInternalViewMode

  // Map of association id -> association and stage id (for quick lookups)
  const assocMap = useMemo(() => {
    const m = new Map<string, { assoc: PipelineAssociation; stageJhsId: string }>()
    for (const opt of stageOptions) {
      for (const a of byStage[opt.jhsId] || []) {
        m.set(a.id, { assoc: a, stageJhsId: opt.jhsId })
      }
    }
    return m
  }, [byStage, stageOptions])

  // Selection mode (controlled or uncontrolled)
  const [internalSelectionMode, setInternalSelectionMode] = useState(false)
  const selectionMode = controlledSelectionMode ?? internalSelectionMode
  const setSelectionMode = onSelectionModeChange ?? setInternalSelectionMode
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const emitSelectedCandidateIds = useCallback((idsSet: Set<string>) => {
    if (!onSelectedIdsChange) return
    const candidateIds = Array.from(idsSet)
      .map((assocId) => assocMap.get(assocId)?.assoc.candidate_id)
      .filter(Boolean) as string[]
    onSelectedIdsChange(candidateIds)
  }, [assocMap, onSelectedIdsChange])

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      emitSelectedCandidateIds(next)
      return next
    })
  }, [emitSelectedCandidateIds])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const selectAllInStage = useCallback((stageJhsId: string) => {
    const ids = (byStage[stageJhsId] || []).map((a) => a.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = ids.every((i) => next.has(i))
      if (allSelected) ids.forEach((i) => next.delete(i))
      else ids.forEach((i) => next.add(i))
      emitSelectedCandidateIds(next)
      return next
    })
  }, [byStage, emitSelectedCandidateIds])

  const toggleMultiple = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const allSelected = ids.every((i) => next.has(i))
      if (allSelected) ids.forEach((i) => next.delete(i))
      else ids.forEach((i) => next.add(i))
      emitSelectedCandidateIds(next)
      return next
    })
  }, [emitSelectedCandidateIds])

  useEffect(() => {
    if (!selectionMode) {
      setSelectedIds(new Set())
      emitSelectedCandidateIds(new Set())
    }
  }, [selectionMode, emitSelectedCandidateIds])

// (assocMap moved earlier)

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  

  const getHeaderBgClass = (type: string) => {
    switch (type) {
      case 'application':
        return 'bg-pastel-blue/20'
      case 'screening':
        return 'bg-info/20'
      case 'interview':
        return 'bg-pastel-purple/20'
      case 'assessment':
        return 'bg-warning/20'
      case 'reference_check':
        return 'bg-pastel-orange/20'
      case 'offer':
        return 'bg-success/20'
      case 'onboarding':
        return 'bg-pastel-green/20'
      default:
        return 'bg-secondary/20'
    }
  }

  const getStageDotColor = (type: string) => {
    switch (type) {
      case 'application':
      case 'screening':
        return 'bg-info'
      case 'interview':
        return 'bg-virgilio-purple'
      case 'assessment':
        return 'bg-warning'
      case 'reference_check':
        return 'bg-pastel-orange'
      case 'offer':
        return 'bg-success'
      case 'onboarding':
        return 'bg-pastel-green'
      default:
        return 'bg-text-tertiary'
    }
  }

  const loadStages = useCallback(async () => {
    const plan = await loadHiringPlanInstances(jobId)
    // Exclude application_review stages unless includeApplicationReview is true
    const filtered = includeApplicationReview
      ? plan
      : plan.filter(opt => opt.stage.stage_type !== 'application_review')
    setStageOptions(filtered.length > 0 ? filtered : [])
  }, [jobId, loadHiringPlanInstances, includeApplicationReview])

  const processPipelineData = useCallback((associations: PipelineAssociation[]) => {
    const active = associations.filter(a => a.status !== 'rejected' && a.status !== 'hired' && a.status !== 'offer')
    const rejectedList = associations.filter(a => a.status === 'rejected')
    const hiredList = associations.filter(a => a.status === 'hired')
    const grouped: Record<string, PipelineAssociation[]> = {}
    active.forEach(a => {
      if (!a.current_stage_id) return
      if (!grouped[a.current_stage_id]) grouped[a.current_stage_id] = []
      grouped[a.current_stage_id].push(a)
    })
    setByStage(grouped)
    setRejected(rejectedList)
    setHired(hiredList)
  }, [])

  const loadPipeline = useCallback(async () => {
    if (!jobId) return
    setIsLoadingCandidates(true)
    try {
      const associations = await fetchAssociationsForJob(jobId)
      processPipelineData(associations)
    } catch (e) {
      console.error('Failed to load pipeline:', e)
      toast({
        title: 'Error',
        description: 'Failed to load candidates in pipeline.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingCandidates(false)
    }
  }, [jobId, fetchAssociationsForJob, processPipelineData])

  const silentRefresh = useCallback(async () => {
    if (!jobId) return
    try {
      const associations = await fetchAssociationsForJob(jobId)
      processPipelineData(associations)
    } catch (e) {
      console.error('Silent refresh failed:', e)
    }
  }, [jobId, fetchAssociationsForJob, processPipelineData])

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      await loadStages()
    })()
  }, [jobId, loadStages])

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      await loadPipeline()
    })()
  }, [jobId, stageOptions, loadPipeline])

  useEffect(() => {
    if (typeof refreshToken !== 'undefined') {
      silentRefresh()
    }
  }, [refreshToken, silentRefresh])

  const handleMove = async (associationId: string, toStageId: string) => {
    await moveAssociationToStage(associationId, toStageId)
    await silentRefresh()
  }

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    
    const assocId = String(active.id)
    const toStageId = String(over.id)
    
    // Determine which candidates to move
    const idsToMove = (selectedIds.has(assocId) && selectedIds.size > 1) 
      ? Array.from(selectedIds) 
      : [assocId]
    
    // Optimistic update: move cards in local state immediately
    setByStage(prev => {
      const next: Record<string, PipelineAssociation[]> = {}
      for (const key of Object.keys(prev)) {
        next[key] = [...prev[key]]
      }
      if (!next[toStageId]) next[toStageId] = []
      
      for (const id of idsToMove) {
        const entry = assocMap.get(id)
        if (!entry || entry.stageJhsId === toStageId) continue
        // Remove from source
        next[entry.stageJhsId] = (next[entry.stageJhsId] || []).filter(a => a.id !== id)
        // Add to target
        next[toStageId] = [...next[toStageId], { ...entry.assoc, current_stage_id: toStageId }]
      }
      return next
    })
    
    // Clear selection after bulk move
    if (idsToMove.length > 1) {
      setSelectedIds(new Set())
      emitSelectedCandidateIds(new Set())
    }
    
    // Server sync in background
    try {
      await Promise.all(idsToMove.map(id => moveAssociationToStage(id, toStageId, { silent: true })))
      toast({
        title: idsToMove.length > 1 ? 'Candidates moved' : 'Candidate moved',
        description: idsToMove.length > 1 
          ? `${idsToMove.length} candidates moved to the selected stage.`
          : 'Candidate moved to the selected stage.',
      })
      // Silently sync server state
      silentRefresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: idsToMove.length > 1 
          ? 'Failed to move some candidates. Please try again.'
          : 'Failed to move candidate to selected stage.',
        variant: 'destructive',
      })
      // Revert on failure
      silentRefresh()
    }
    onStageChanged?.()
  }, [moveAssociationToStage, silentRefresh, selectedIds, emitSelectedCandidateIds, onStageChanged, assocMap])

  // Get all associations for status-based sorting
  const allAssociations = useMemo(() => {
    const all: PipelineAssociation[] = []
    for (const opt of stageOptions) {
      for (const a of byStage[opt.jhsId] || []) {
        all.push(a)
      }
    }
    return all
  }, [byStage, stageOptions])

  // Get status priorities for all candidates (batch query)
  const { statusMap, isLoading: isStatusLoading } = usePipelineCandidateStatuses(jobId, allAssociations)

  // Mark board as "has rendered once" so subsequent refreshes skip the skeleton
  useEffect(() => {
    if (!isLoadingPlan && !isLoadingCandidates && !isStatusLoading) {
      hasRenderedOnce.current = true
    }
  }, [isLoadingPlan, isLoadingCandidates, isStatusLoading])

  const getTimeInfo = useCallback((a: PipelineAssociation) => {
    const base = a.entered_stage_at || a.created_at
    const nowMs = Date.now()
    const startedMs = base ? new Date(base).getTime() : nowMs
    let diffSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000))

    // Check if the candidate has recent activity (priority 1-3 means scorecard/interview activity)
    const status = statusMap.get(a.id)
    const hasRecentActivity = status && status.priority <= 3

    if (diffSec < 60) {
      return { label: `${diffSec}s`, variant: 'success' as const }
    }
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) {
      return { label: `${diffMin}m`, variant: 'success' as const }
    }
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) {
      return { label: `${diffH}h`, variant: 'success' as const }
    }
    const diffD = Math.floor(diffH / 24)
    if (diffD < 7) {
      return { label: `${diffD}d`, variant: hasRecentActivity ? 'success' as const : 'warning' as const }
    }
    if (diffD >= 28) {
      const months = Math.max(1, Math.floor(diffD / 30))
      return { label: `${months}mo`, variant: hasRecentActivity ? 'warning' as const : 'destructive' as const }
    }
    const diffW = Math.floor(diffD / 7)
    return { label: `${diffW}w`, variant: hasRecentActivity ? 'warning' as const : 'destructive' as const }
  }, [statusMap])

  const sortByStatusPriority = useCallback((a: PipelineAssociation, b: PipelineAssociation) => {
    const statusA = statusMap.get(a.id) ?? { priority: 5, sortTime: new Date(a.entered_stage_at || a.created_at).getTime() }
    const statusB = statusMap.get(b.id) ?? { priority: 5, sortTime: new Date(b.entered_stage_at || b.created_at).getTime() }
    
    // Primary: Sort by status priority (1 = highest priority = first)
    if (statusA.priority !== statusB.priority) {
      return statusA.priority - statusB.priority
    }
    
    // Secondary: Sort by time (ascending = oldest/soonest first)
    return statusA.sortTime - statusB.sortTime
  }, [statusMap])

  // Filter by favorite
  const filterByFavorite = useCallback((assoc: PipelineAssociation) => {
    if (favoriteFilter.length === 0) return true
    if (favoriteFilter.includes('yes') && assoc.is_favorite) return true
    if (favoriteFilter.includes('no') && !assoc.is_favorite) return true
    return false
  }, [favoriteFilter])

  // Sorted candidates by stage (for board view rendering)
  const sortedByStage = useMemo(() => {
    const result: Record<string, PipelineAssociation[]> = {}
    for (const opt of stageOptions) {
      const arr = (byStage[opt.jhsId] || []).filter(filterByFavorite).slice().sort(sortByStatusPriority)
      result[opt.jhsId] = arr
    }
    return result
  }, [byStage, stageOptions, sortByStatusPriority, filterByFavorite])


  // Flat list of candidates for list view
  const flatCandidates = useMemo(() => {
    const rows: { assoc: PipelineAssociation; stage: JobStage; stageJhsId: string }[] = []
    for (const opt of stageOptions) {
      for (const a of sortedByStage[opt.jhsId] || []) {
        rows.push({ assoc: a, stage: opt.stage, stageJhsId: opt.jhsId })
      }
    }
    return rows
  }, [sortedByStage, stageOptions])

  // List view helpers
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')

  const distinctStages = useMemo(() => {
    return Array.from(new Set(stageOptions.map(opt => opt.stage.stage_name))).filter(Boolean)
  }, [stageOptions])

  type ListRow = {
    id: string
    candidateId: string
    name: string
    stageName: string
    stageType: string
    timeLabel: string
    timeVariant: import('@/components/ui/badge').BadgeProps['variant']
    timeSortValue: number
    linkedinUrl?: string
  }

  const listRows: ListRow[] = useMemo(() => {
    const now = Date.now()
    return flatCandidates.map(({ assoc, stage }) => {
      const base = assoc.entered_stage_at || assoc.created_at
      const timeMs = Math.max(0, now - new Date(base).getTime())
      const t = getTimeInfo(assoc)
      return {
        id: assoc.id,
        candidateId: assoc.candidate_id,
        name: assoc.candidate_name || 'Unnamed Candidate',
        stageName: stage.stage_name,
        stageType: stage.stage_type,
        timeLabel: t.label,
        timeVariant: t.variant,
        timeSortValue: timeMs,
        linkedinUrl: assoc.linkedin_url || undefined,
      }
    })
  }, [flatCandidates, getTimeInfo])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return listRows.filter((r) =>
      (stageFilter === 'all' || r.stageName === stageFilter) &&
      (term === '' || r.name.toLowerCase().includes(term))
    )
  }, [listRows, stageFilter, search])

  const { sortedData, sortConfig, requestSort } = useSortableTable<ListRow>(filteredRows, {
    key: 'timeSortValue',
    direction: 'desc',
  })

  const groupedByStage = useMemo(() => {
    const map = new Map<string, { stageType: string; rows: ListRow[] }>()
    for (const row of sortedData) {
      const entry = map.get(row.stageName) || { stageType: row.stageType, rows: [] }
      entry.rows.push(row)
      map.set(row.stageName, entry)
    }
    return Array.from(map.entries()).map(([stageName, v]) => ({ stageName, stageType: v.stageType, rows: v.rows }))
  }, [sortedData])

  const defaultOpenGroups = useMemo(() => groupedByStage.map(g => g.stageName), [groupedByStage])

  // Ordered list of candidate IDs across the pipeline (respects current view)
  const orderedCandidateIds = useMemo(() => {
    if (currentView === 'list') {
      // List view: use the table's sorted order (respects user's column sorting)
      return sortedData.map(r => r.candidateId)
    } else {
      // Board view: use status-priority sort order (left-to-right, top-to-bottom)
      const perStage = stageOptions.map(opt => sortedByStage[opt.jhsId] || [])
      return perStage.flat().map(a => a.candidate_id)
    }
  }, [currentView, sortedData, sortedByStage, stageOptions])

  // Update ref whenever orderedCandidateIds changes (for snapshot capture)
  useEffect(() => {
    if (!isStatusLoading && orderedCandidateIds.length > 0) {
      navigationSnapshotRef.current = orderedCandidateIds
    }
  }, [orderedCandidateIds, isStatusLoading])

  // Snapshot navigation order when sheet opens - this is the KEY fix
  // Navigation will use this snapshot throughout the session, not the live order
  const handleOpenCandidateSheet = useCallback((candidateId: string) => {
    // Capture current visual order as the navigation order for this session
    const currentOrder = navigationSnapshotRef.current.length > 0 
      ? navigationSnapshotRef.current 
      : orderedCandidateIds
    setNavigationSnapshot(currentOrder)
    setSelectedCandidateId(candidateId)
    setPanelOpen(true)
  }, [orderedCandidateIds])

  // Use snapshot for navigation (not live orderedCandidateIds)
  const activeNavigationOrder = panelOpen && navigationSnapshot.length > 0 
    ? navigationSnapshot 
    : orderedCandidateIds

  const currentIndex = selectedCandidateId 
    ? activeNavigationOrder.indexOf(selectedCandidateId) 
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < activeNavigationOrder.length - 1

  const handlePrevCandidate = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedCandidateId(activeNavigationOrder[currentIndex - 1])
    }
  }, [currentIndex, activeNavigationOrder])

  const handleNextCandidate = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < activeNavigationOrder.length - 1) {
      setSelectedCandidateId(activeNavigationOrder[currentIndex + 1])
    }
  }, [currentIndex, activeNavigationOrder])

  // Clear snapshot when sheet closes
  useEffect(() => {
    if (!panelOpen) {
      setNavigationSnapshot([])
    }
  }, [panelOpen])

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
            <p className="text-sm text-text-secondary hidden md:block">Columns reflect the job's hiring plan stages.</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Board view"
              className={`${currentView === 'board' ? 'bg-foreground text-background hover:bg-foreground' : 'text-text-secondary hover:bg-transparent'} !rounded-full`}
              onClick={() => setCurrentView('board')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="List view"
              className={`${currentView === 'list' ? 'bg-foreground text-background hover:bg-foreground' : 'text-text-secondary hover:bg-transparent'} !rounded-full`}
              onClick={() => setCurrentView('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Filter chips (only when internal header is shown; toolbar lives in JobDetail otherwise) */}
      {showHeader && (
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <FilterChipPopover
            label="Favorite"
            options={[
              { value: 'yes', label: 'Favorites', count: allAssociations.filter(a => a.is_favorite).length },
              { value: 'no', label: 'Not Favorites', count: allAssociations.filter(a => !a.is_favorite).length },
            ]}
            selectedValues={favoriteFilter}
            onSelectionChange={setFavoriteFilter}
          />
        </div>
      )}

      {/* Unified loading gate: show skeleton only on initial load; after first render, keep board mounted */}
      {(!hasRenderedOnce.current && (isLoadingPlan || isLoadingCandidates || isStatusLoading)) ? (
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 4 }).map((_, colIdx) => (
            <div key={colIdx} className="w-72 flex-shrink-0 rounded-lg border bg-card flex flex-col">
              <div className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              </div>
              <div className="p-3 space-y-2 flex-1">
                {Array.from({ length: colIdx === 0 ? 4 : colIdx === 1 ? 3 : 2 }).map((_, cardIdx) => (
                  <div key={cardIdx} className="rounded-lg border bg-background p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex items-center gap-2 pt-1">
                      <Skeleton className="h-5 w-10 rounded-full" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : currentView === 'board' ? (
        <>
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={`flex gap-4 ${externalScroll ? '' : 'overflow-x-auto snap-x snap-mandatory sm:snap-none'} pb-2`}>

              {stageOptions.length === 0 && (
                <Card className="min-w-[280px]">
                  <CardContent className="py-8 text-center text-text-secondary text-sm">
                    No hiring plan defined yet.
                  </CardContent>
                </Card>
              )}

              {/* Render columns with candidate cards */}
              {stageOptions.map((opt) => (
                <div key={opt.jhsId} className="group w-[calc(100vw-3rem)] sm:w-72 flex-shrink-0 h-full flex flex-col snap-center sm:snap-align-none">
                  <div className="px-1 pb-2 pt-1 shrink-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full flex-shrink-0 ${getStageDotColor(opt.stage.stage_type)}`} aria-hidden />
                        <span className="font-poppins text-[14px] font-semibold text-text-primary truncate" title={opt.stage.stage_name}>
                          {opt.stage.stage_name}
                        </span>
                        <span className="text-[12px] font-medium text-text-tertiary tabular-nums">
                          {(sortedByStage[opt.jhsId] || []).length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {stageHasAutomation.get(opt.jhsId) && (
                          <Zap className="h-3.5 w-3.5 text-virgilio-purple fill-virgilio-purple flex-shrink-0" />
                        )}
                        {selectionMode && (
                          <div className="flex items-center gap-1.5 pr-1" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={(sortedByStage[opt.jhsId] || []).length > 0 && (sortedByStage[opt.jhsId] || []).every(a => isSelected(a.id))}
                              onCheckedChange={() => selectAllInStage(opt.jhsId)}
                              aria-label="Select all in stage"
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          aria-label="Stage actions"
                          className="h-6 w-6 inline-flex items-center justify-center rounded-md text-text-tertiary hover:bg-[#F1F0EC] hover:text-text-primary transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <span className="text-base leading-none">···</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto flex flex-col gap-2">
                    <DroppableStage id={opt.jhsId} isEmpty={!sortedByStage[opt.jhsId] || sortedByStage[opt.jhsId].length === 0} tintClass="">
                      {!isLoadingCandidates && (!sortedByStage[opt.jhsId] || sortedByStage[opt.jhsId].length === 0) && (
                        <div className="min-h-[120px] rounded-xl border border-dashed border-virgilio-border/60" />
                      )}

                      <div className="space-y-2">
                        {(sortedByStage[opt.jhsId] || []).map(assoc => {
                          const t = getTimeInfo(assoc)
                          const isPartOfBulkDrag = activeId !== null && 
                            activeId !== assoc.id && 
                            selectedIds.has(assoc.id) && 
                            selectedIds.has(activeId) && 
                            selectedIds.size > 1
                          return (
                            <DraggableCandidateCard id={assoc.id} key={assoc.id} isPartOfBulkDrag={isPartOfBulkDrag}>
                              <CandidateCard
                                candidateId={assoc.candidate_id}
                                associationId={assoc.id}
                                candidateName={assoc.candidate_name}
                                linkedinUrl={assoc.linkedin_url}
                                phone={assoc.phone}
                                stageOptions={stageOptions}
                                currentStageJhsId={opt.jhsId}
                                timeInStageLabel={t.label}
                                timeBadgeVariant={t.variant}
                                onMove={(toId) => handleMove(assoc.id, toId)}
                                onClick={() => { 
                                  if (onCandidateClick) {
                                    const currentOrder = navigationSnapshotRef.current.length > 0 
                                      ? navigationSnapshotRef.current 
                                      : orderedCandidateIds
                                    onCandidateClick(assoc.candidate_id, currentOrder);
                                  } else {
                                    handleOpenCandidateSheet(assoc.candidate_id);
                                  }
                                }}
                                showCheckbox={selectionMode}
                                checked={isSelected(assoc.id)}
                                onCheckedChange={(v) => toggleSelect(assoc.id, !!v)}
                                jobId={jobId}
                                whatsappTemplateSentAt={assoc.whatsapp_template_sent_at}
                                isFavorite={assoc.is_favorite}
                              />
                            </DraggableCandidateCard>
                          )
                        })}
                      </div>
                    </DroppableStage>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-dashed border-virgilio-border/60 px-3 py-2.5 text-[13px] text-text-tertiary hover:text-text-primary hover:border-virgilio-border transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      <span className="text-base leading-none">+</span> Add candidate
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
              {activeId && assocMap.get(activeId) ? (
                (() => {
                  const { assoc, stageJhsId } = assocMap.get(activeId)!
                  const t = getTimeInfo(assoc)
                  const dragCount = (selectedIds.has(activeId) && selectedIds.size > 1) 
                    ? selectedIds.size 
                    : 1
                  
                  return (
                    <div className="relative w-72 pointer-events-none">
                      {/* Stacked cards effect when dragging multiple */}
                      {dragCount > 1 && (
                        <>
                          <div className="absolute -top-2 left-2 right-2 h-full rounded-lg bg-card border border-border shadow-md opacity-50" />
                          <div className="absolute -top-1 left-1 right-1 h-full rounded-lg bg-card border border-border shadow-md opacity-70" />
                        </>
                      )}
                      
                      {/* Main dragged card */}
                      <div 
                        className="relative"
                        style={{ 
                          transform: 'rotate(-1.5deg) scale(1.03)', 
                          boxShadow: '0 12px 24px rgba(0,0,0,0.15)' 
                        }}
                      >
                        <CandidateCard
                          candidateId={assoc.candidate_id}
                          associationId={assoc.id}
                          candidateName={assoc.candidate_name}
                          linkedinUrl={assoc.linkedin_url}
                          phone={assoc.phone}
                          stageOptions={stageOptions}
                          currentStageJhsId={stageJhsId}
                          timeInStageLabel={t.label}
                          timeBadgeVariant={t.variant}
                          onMove={(toId) => handleMove(assoc.id, toId)}
                          onClick={() => { 
                            if (onCandidateClick) {
                              const currentOrder = navigationSnapshotRef.current.length > 0 
                                ? navigationSnapshotRef.current 
                                : orderedCandidateIds
                              onCandidateClick(assoc.candidate_id, currentOrder);
                            } else {
                              handleOpenCandidateSheet(assoc.candidate_id);
                            }
                          }}
                        />
                      </div>
                      
                      {/* Count badge */}
                      {dragCount > 1 && (
                        <Badge 
                          className="absolute -top-3 -right-3 bg-primary text-primary-foreground shadow-lg z-10 min-w-[24px] justify-center"
                        >
                          {dragCount}
                        </Badge>
                      )}
                    </div>
                  )
                })()
              ) : null}
            </DragOverlay>
          </DndContext>
        </>
      ) : (
        <div>
          <Card className="w-full">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Candidates</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-56">
                    <Input
                      placeholder="Search candidates"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stages</SelectItem>
                      {distinctStages.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-text-tertiary ml-1">
                    {filteredRows.length} result{filteredRows.length === 1 ? '' : 's'}
                  </div>
                  <div className="hidden sm:flex items-center gap-2 ml-4">
                    <span className="text-xs text-text-tertiary">Sort:</span>
                    <SortableHeader sortKey="name" currentSort={sortConfig} onSort={requestSort} className="text-xs">Name</SortableHeader>
                    <SortableHeader sortKey="timeSortValue" currentSort={sortConfig} onSort={requestSort} className="text-xs">Time</SortableHeader>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCandidates ? (
                <div className="space-y-3 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 h-10">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-5 w-10 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : sortedData.length === 0 ? (
                <GioEmptyState title="No candidates in pipeline" description="Candidates will appear here as they progress through stages" />
              ) : (
                <div className="space-y-3">
                  <Accordion type="multiple" defaultValue={defaultOpenGroups} className="w-full">
                    {groupedByStage.map((group) => (
                      <AccordionItem key={group.stageName} value={group.stageName} className="border-none">
                        <div className={`${getHeaderBgClass(group.stageType)} rounded-md`}> 
                          <AccordionTrigger className="w-full rounded-t-md px-3 py-2 hover:no-underline">
                            <div className="flex w-full items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-text-primary">{group.stageName}</span>
                                {selectionMode && (
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                      checked={group.rows.length > 0 && group.rows.every(r => isSelected(r.id))}
                                      onCheckedChange={() => toggleMultiple(group.rows.map(r => r.id))}
                                      aria-label="Select all in group"
                                    />
                                    <span className="text-xs text-text-secondary">All</span>
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline">{group.rows.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-3 pb-3">
                            <div className="w-full">
                              <Table density="compact" className="w-full">
                                <TableBody>
                                  {group.rows.map((row) => (
                                    <TableRow key={row.id} interactive className="hover:bg-transparent" onClick={() => { 
                                      if (onCandidateClick) {
                                        const currentOrder = navigationSnapshotRef.current.length > 0 
                                          ? navigationSnapshotRef.current 
                                          : orderedCandidateIds
                                        onCandidateClick(row.candidateId, currentOrder);
                                      } else {
                                        handleOpenCandidateSheet(row.candidateId);
                                      }
                                    }}>
                                      {selectionMode && (
                                        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                                          <Checkbox
                                            checked={isSelected(row.id)}
                                            onCheckedChange={(v) => toggleSelect(row.id, !!v)}
                                            aria-label="Select candidate"
                                          />
                                        </TableCell>
                                      )}
                                      <TableCell className="w-full">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <Avatar className="h-8 w-8">
                                            <AvatarFallback>{row.name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}</AvatarFallback>
                                          </Avatar>
                                          <div className="min-w-0">
                                            <div className="truncate font-medium text-text-primary" title={row.name}>{row.name}</div>
                                            {row.linkedinUrl && (
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <a href={row.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                                      <ExternalLink className="inline-block h-3.5 w-3.5 mr-1" />
                                                      LinkedIn
                                                    </a>
                                                  </TooltipTrigger>
                                                  <TooltipContent>Open LinkedIn profile</TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="w-32">
                                        <Badge variant={row.timeVariant}>{row.timeLabel}</Badge>
                                      </TableCell>
                                      <TableCell className="w-28 text-right">
                                        <Button size="sm" variant="outline" onClick={(e) => { 
                                          e.stopPropagation();
                                          if (onCandidateClick) {
                                            const currentOrder = navigationSnapshotRef.current.length > 0 
                                              ? navigationSnapshotRef.current 
                                              : orderedCandidateIds
                                            onCandidateClick(row.candidateId, currentOrder);
                                          } else {
                                            setSelectedCandidateId(row.candidateId);
                                            setPanelOpen(true);
                                          }
                                        }}>
                                          View
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </div>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {!onCandidateClick && (
        <CandidateProfileSheet open={panelOpen} onOpenChange={(o) => setPanelOpen(o)} candidateId={selectedCandidateId} jobId={jobId} hasPrev={hasPrev} hasNext={hasNext} onNavigatePrev={handlePrevCandidate} onNavigateNext={handleNextCandidate} onStageChanged={() => { silentRefresh(); onStageChanged?.(); }} />
      )}
    </div>
  )
}

