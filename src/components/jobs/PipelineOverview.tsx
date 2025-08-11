
import { useEffect, useState, useCallback, useMemo } from 'react'
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
import { LayoutGrid, List } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { useSortableTable } from '@/hooks/useSortableTable'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ExternalLink } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'


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
}


const stageTypeVariants: Record<string, import('@/components/ui/badge').BadgeProps['variant']> = {
  application: 'pastel-blue',
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

export function PipelineOverview({ jobId, showHeader = true, externalScroll = false, viewMode: controlledView, onViewModeChange, selectionMode: controlledSelectionMode, onSelectionModeChange, onSelectedIdsChange, refreshToken, onStageChanged }: PipelineOverviewProps) {
  const { loadHiringPlanInstances, isLoadingPlan } = useJobHiringPlan()
  const { fetchAssociationsForJob, moveAssociationToStage, updateAssociationStatus } = usePipelineActions()

  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: JobStage; position: number }[]>([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false)
  const [byStage, setByStage] = useState<Record<string, PipelineAssociation[]>>({})
  const [rejected, setRejected] = useState<PipelineAssociation[]>([])
  const [hired, setHired] = useState<PipelineAssociation[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 10 } })
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  const sensors = useSensors(mouseSensor, touchSensor)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [internalViewMode, setInternalViewMode] = useState<'board' | 'list'>('board')
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

  const getTimeInfo = useCallback((a: PipelineAssociation) => {
    const base = a.entered_stage_at || a.created_at
    const nowMs = Date.now()
    const startedMs = base ? new Date(base).getTime() : nowMs
    let diffSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000))

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
      return { label: `${diffD}d`, variant: 'warning' as const }
    }
    // Weeks and months -> red
    if (diffD >= 28) {
      const months = Math.max(1, Math.floor(diffD / 30))
      return { label: `${months}mo`, variant: 'destructive' as const }
    }
    const diffW = Math.floor(diffD / 7)
    return { label: `${diffW}w`, variant: 'destructive' as const }
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

  const loadStages = useCallback(async () => {
    const plan = await loadHiringPlanInstances(jobId)
    setStageOptions(plan.length > 0 ? plan : [])
  }, [jobId, loadHiringPlanInstances])

  const loadPipeline = useCallback(async () => {
    if (!jobId) return
    setIsLoadingCandidates(true)
    try {
      const associations = await fetchAssociationsForJob(jobId)
      const active = associations.filter(a => a.status !== 'rejected' && a.status !== 'hired')
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
  }, [jobId, fetchAssociationsForJob])

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
      loadPipeline()
    }
  }, [refreshToken, loadPipeline])

  const handleMove = async (associationId: string, toStageId: string) => {
    await moveAssociationToStage(associationId, toStageId)
    await loadPipeline()
  }

  const onDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const assocId = String(active.id)
    const toStageId = String(over.id)
    await moveAssociationToStage(assocId, toStageId)
    await loadPipeline()
  }, [moveAssociationToStage, loadPipeline])

  // Ordered list of candidate IDs across the pipeline (by stage order, then pipeline_position, then created_at)
  const orderedCandidateIds = useMemo(() => {
    const perStage = stageOptions.map(opt => {
      const arr = (byStage[opt.jhsId] || []).slice().sort((a, b) => {
        const pa = a.pipeline_position ?? Number.MAX_SAFE_INTEGER
        const pb = b.pipeline_position ?? Number.MAX_SAFE_INTEGER
        if (pa !== pb) return pa - pb
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      return arr
    })
    return perStage.flat().map(a => a.candidate_id)
  }, [byStage, stageOptions])

  // Flat list of candidates for list view
  const flatCandidates = useMemo(() => {
    const rows: { assoc: PipelineAssociation; stage: JobStage; stageJhsId: string }[] = []
    for (const opt of stageOptions) {
      const arr = (byStage[opt.jhsId] || []).slice().sort((a, b) => {
        const pa = a.pipeline_position ?? Number.MAX_SAFE_INTEGER
        const pb = b.pipeline_position ?? Number.MAX_SAFE_INTEGER
        if (pa !== pb) return pa - pb
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      for (const a of arr) {
        rows.push({ assoc: a, stage: opt.stage, stageJhsId: opt.jhsId })
      }
    }
    return rows
  }, [byStage, stageOptions])

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

  const currentIndex = selectedCandidateId ? orderedCandidateIds.indexOf(selectedCandidateId) : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < orderedCandidateIds.length - 1

  const handlePrevCandidate = useCallback(() => {
    if (hasPrev) {
      setSelectedCandidateId(orderedCandidateIds[currentIndex - 1])
    }
  }, [hasPrev, currentIndex, orderedCandidateIds])

  const handleNextCandidate = useCallback(() => {
    if (hasNext) {
      setSelectedCandidateId(orderedCandidateIds[currentIndex + 1])
    }
  }, [hasNext, currentIndex, orderedCandidateIds])

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Pipeline Overview</h1>
            <p className="text-sm text-text-secondary">Columns reflect the job's hiring plan stages.</p>
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

      {currentView === 'board' ? (
        <>
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <div className={`flex gap-4 ${externalScroll ? '' : 'overflow-x-auto'} pb-2`}>
              {isLoadingPlan && (
                <div className="text-sm text-text-secondary">Loading pipeline...</div>
              )}

              {!isLoadingPlan && stageOptions.length === 0 && (
                <Card className="min-w-[280px]">
                  <CardContent className="py-8 text-center text-text-secondary text-sm">
                    No hiring plan defined yet.
                  </CardContent>
                </Card>
              )}

              {/* Render columns with candidate cards */}
              {!isLoadingPlan && stageOptions.map((opt) => (
                <Card key={opt.jhsId} className="w-72 flex-shrink-0 h-full flex flex-col">
                  <CardHeader className={`pb-2 rounded-t-md shrink-0 ${getHeaderBgClass(opt.stage.stage_type)}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <CardTitle className="text-base font-medium truncate max-w-[160px]" title={opt.stage.stage_name}>
                          {opt.stage.stage_name}
                        </CardTitle>
                        {opt.stage.is_default && (
                          <Badge variant="outline">Default</Badge>
                        )}
                        {isLastPriorityStage(opt.stage) && (
                          <Badge variant="outline">Last</Badge>
                        )}
                      </div>
                      {selectionMode && (
                        <div className="flex items-center gap-2 pr-1" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={(byStage[opt.jhsId] || []).length > 0 && (byStage[opt.jhsId] || []).every(a => isSelected(a.id))}
                            onCheckedChange={() => selectAllInStage(opt.jhsId)}
                            aria-label="Select all in stage"
                          />
                          <span className="text-xs text-text-secondary">All</span>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className={`${getHeaderBgClass(opt.stage.stage_type)} rounded-b-md flex-1 overflow-y-auto`}>
                    <DroppableStage id={opt.jhsId} isEmpty={!byStage[opt.jhsId] || byStage[opt.jhsId].length === 0} tintClass={getHeaderBgClass(opt.stage.stage_type)}>
                      {isLoadingCandidates && (
                        <div className="text-xs text-text-tertiary">Loading candidates...</div>
                      )}

                      {!isLoadingCandidates && (!byStage[opt.jhsId] || byStage[opt.jhsId].length === 0) && (
                        <div className="text-xs text-text-tertiary">
                          No candidates in this stage
                        </div>
                      )}

                      <div className="space-y-2">
                        {(byStage[opt.jhsId] || []).map(assoc => {
                          const t = getTimeInfo(assoc)
                          return (
                            <DraggableCandidateCard id={assoc.id} key={assoc.id}>
                              <CandidateCard
                                candidateName={assoc.candidate_name}
                                linkedinUrl={assoc.linkedin_url}
                                stageOptions={stageOptions}
                                currentStageJhsId={opt.jhsId}
                                timeInStageLabel={t.label}
                                timeBadgeVariant={t.variant}
                                onMove={(toId) => handleMove(assoc.id, toId)}
                                onClick={() => { setSelectedCandidateId(orderedCandidateIds.find(id => id === assoc.candidate_id) || assoc.candidate_id); setPanelOpen(true) }}
                                showCheckbox={selectionMode}
                                checked={isSelected(assoc.id)}
                                onCheckedChange={(v) => toggleSelect(assoc.id, !!v)}
                              />
                            </DraggableCandidateCard>
                          )
                        })}
                      </div>
                    </DroppableStage>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DragOverlay>
              {activeId && assocMap.get(activeId) ? (
                (() => {
                  const { assoc, stageJhsId } = assocMap.get(activeId)!
                  const t = getTimeInfo(assoc)
                  return (
                    <div className="w-72 pointer-events-none" style={{ transform: 'rotate(-2deg) scale(1.02)', boxShadow: '0 12px 28px rgba(0,0,0,0.18)' }}>
                      <CandidateCard
                        candidateName={assoc.candidate_name}
                        linkedinUrl={assoc.linkedin_url}
                        stageOptions={stageOptions}
                        currentStageJhsId={stageJhsId}
                        timeInStageLabel={t.label}
                        timeBadgeVariant={t.variant}
                        onMove={(toId) => handleMove(assoc.id, toId)}
                        onClick={() => { setSelectedCandidateId(orderedCandidateIds.find(id => id === assoc.candidate_id) || assoc.candidate_id); setPanelOpen(true) }}
                      />
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
                <TableSkeleton rows={6} />
              ) : sortedData.length === 0 ? (
                <div className="text-sm text-text-secondary py-6">No candidates match your filters.</div>
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
                              <Table className="w-full">
                                <TableBody>
                                  {group.rows.map((row) => (
                                    <TableRow key={row.id} interactive className="hover:bg-transparent" onClick={() => { setSelectedCandidateId(row.candidateId); setPanelOpen(true) }}>
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
                                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(row.candidateId); setPanelOpen(true) }}>
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
      <CandidateProfileSheet open={panelOpen} onOpenChange={(o) => setPanelOpen(o)} candidateId={selectedCandidateId} jobId={jobId} hasPrev={hasPrev} hasNext={hasNext} onNavigatePrev={handlePrevCandidate} onNavigateNext={handleNextCandidate} onStageChanged={() => { loadPipeline(); onStageChanged?.(); }} />
    </div>
  )
}

