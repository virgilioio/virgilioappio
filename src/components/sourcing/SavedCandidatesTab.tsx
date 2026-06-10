import { useState } from 'react'
import { useSavedCandidates, SavedCandidate } from '@/hooks/useSavedCandidates'
import { useArchiveSavedCandidate } from '@/hooks/useArchiveSavedCandidate'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { LinkedInFilled } from '@/components/icons/LinkedInFilled'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Archive,
  CheckSquare,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftPlane } from '@/components/ui/EmptyIllustrations'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface SavedCandidatesTabProps {
  projectId: string
  jobId?: string | null
}

export function SavedCandidatesTab({ projectId, jobId }: SavedCandidatesTabProps) {
  const { data: savedCandidates = [], isLoading, refetch } = useSavedCandidates({ 
    projectId, 
    enabled: !!projectId 
  })
  
  const { archiveCandidate, isArchiving } = useArchiveSavedCandidate()
  const { createAssociationAndMove } = usePipelineActions()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  
  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: { stage_name: string }; position: number }[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [loadingStages, setLoadingStages] = useState(false)
  const [isMovingToPipeline, setIsMovingToPipeline] = useState(false)

  const selectedCandidate = selectedIndex !== null ? savedCandidates[selectedIndex] : null

  const handleEnterSelectionMode = async () => {
    if (!jobId) {
      toast.error('No job linked', { description: 'Link this search to a job first to move candidates to a pipeline.' })
      return
    }
    setSelectionMode(true)
    setLoadingStages(true)
    try {
      const options = await loadHiringPlanInstances(jobId)
      setStageOptions(options || [])
      if (options && options.length > 0) setSelectedStageId(options[0].jhsId)
    } finally {
      setLoadingStages(false)
    }
  }

  const handleExitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setSelectedStageId('')
  }

  const handleToggleSelection = (e: React.MouseEvent, candidateId: string) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(candidateId) ? next.delete(candidateId) : next.add(candidateId)
      return next
    })
  }

  const handleSelectAll = () => {
    setSelectedIds(prev =>
      prev.size === savedCandidates.length ? new Set() : new Set(savedCandidates.map(c => c.id))
    )
  }

  const handleMoveToPipeline = async () => {
    if (!jobId || !selectedStageId || selectedIds.size === 0) return
    setIsMovingToPipeline(true)
    let successCount = 0, failCount = 0
    for (const candidate of savedCandidates.filter(c => selectedIds.has(c.id))) {
      try {
        await createAssociationAndMove(jobId, candidate.id, selectedStageId)
        successCount++
      } catch {
        failCount++
      }
    }
    if (successCount > 0) toast.success(`Moved ${successCount} candidate${successCount !== 1 ? 's' : ''} to pipeline`)
    if (failCount > 0) toast.error(`Failed to move ${failCount} candidate${failCount !== 1 ? 's' : ''}`)
    handleExitSelectionMode()
    refetch()
    setIsMovingToPipeline(false)
  }

  const handleCandidateClick = (index: number) => {
    if (selectionMode) return
    setSelectedIndex(index)
    setSheetOpen(true)
  }

  const handleArchive = (e: React.MouseEvent, candidate: SavedCandidate) => {
    e.stopPropagation()
    archiveCandidate({ apolloId: candidate.apollo_id!, projectId })
  }

  const formatLocation = (c: SavedCandidate) =>
    [c.location_city, c.location_state, c.location_country].filter(Boolean).join(', ') || null

  if (isLoading) {
    return (
      <Card className="shadow-calendly m-4">
        <CardContent className="p-0">
          <Table>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-4 w-4 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-16 rounded-full" />
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-36" />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    )
  }

  if (savedCandidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <EmptyState
          variant="page"
          title="No candidates collected yet"
          description={`Candidates you reveal from the search results will appear here. Go to the Candidates tab and click "Reveal Full Profile" to collect candidates.`}
        />
      </div>
    )
  }

  return (
    <>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 shrink-0">
          {selectionMode ? (
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="ghost" size="sm" onClick={handleExitSelectionMode}>
                <X className="h-4 w-4 mr-1" />Cancel
              </Button>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedIds.size === savedCandidates.length ? 'Deselect All' : 'Select All'}
              </Button>
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
              <div className="flex items-center gap-2">
                <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={loadingStages || stageOptions.length === 0}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={loadingStages ? 'Loading...' : stageOptions.length ? 'Select stage' : 'No stages'} />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((opt) => (
                      <SelectItem key={opt.jhsId} value={opt.jhsId}>{opt.stage.stage_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleMoveToPipeline} disabled={selectedIds.size === 0 || !selectedStageId || isMovingToPipeline}>
                  {isMovingToPipeline ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-1" />}
                  Move to Pipeline
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {jobId && (
                <Button variant="outline" size="sm" onClick={handleEnterSelectionMode}>
                  <CheckSquare className="h-4 w-4 mr-1" />Select Candidates
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <Card className="shadow-calendly mx-4 flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-full">Candidate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {savedCandidates.map((candidate, index) => {
                    const isSelected = selectedIds.has(candidate.id)
                    const isActiveRow = sheetOpen && selectedIndex === index
                    const location = formatLocation(candidate)

                    return (
                      <TableRow
                        key={candidate.id}
                        className={cn(
                          "cursor-pointer hover:bg-muted/40",
                          isSelected && "bg-muted/30",
                          isActiveRow && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                        onClick={() => selectionMode
                          ? handleToggleSelection({ stopPropagation: () => {} } as React.MouseEvent, candidate.id)
                          : handleCandidateClick(index)
                        }
                      >
                        <TableCell colSpan={1} className="py-3 px-4">
                          <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            {selectionMode && (
                              <div className="pt-0.5" onClick={(e) => handleToggleSelection(e, candidate.id)}>
                                <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                              </div>
                            )}
                            {/* Main content */}
                            <div className="flex-1 min-w-0 space-y-1.5">
                              {/* Badge row */}
                              <div className="flex items-center justify-between">
                                <Badge variant="pastel-blue" className="text-[10px] px-1.5 py-0 h-4">Collected</Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(candidate.apollo_collected_at), 'MMM d, yyyy')}
                                </span>
                              </div>
                              {/* Name */}
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{candidate.candidate_name}</span>
                                {candidate.linkedin_url && (
                                  <a
                                    href={candidate.linkedin_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    <LinkedInFilled className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                              {/* Role @ Company */}
                              {(candidate.role_current || candidate.company_current) && (
                                <p className="text-xs text-muted-foreground">
                                  {candidate.role_current}
                                  {candidate.role_current && candidate.company_current && ' at '}
                                  {candidate.company_current}
                                </p>
                              )}
                              {/* Metadata chips */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {location && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <MapPin className="h-2.5 w-2.5" />{location}
                                  </span>
                                )}
                                {candidate.email && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <Mail className="h-2.5 w-2.5" />{candidate.email}
                                  </span>
                                )}
                                {candidate.phone && (
                                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                                    <Phone className="h-2.5 w-2.5" />{candidate.phone}
                                  </span>
                                )}
                              </div>
                              {/* Job associations */}
                              {candidate.job_associations.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {candidate.job_associations.map((assoc, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                                      {assoc.job_title}
                                      {assoc.stage_name && <span className="ml-1 opacity-70">• {assoc.stage_name}</span>}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Actions */}
                            {!selectionMode && (
                              <div className="flex items-center gap-1 pt-0.5 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => handleArchive(e, candidate)}
                                  disabled={isArchiving}
                                  title="Archive candidate"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidate?.id || null}
        jobId={selectedCandidate?.job_associations[0]?.job_id || null}
        context={selectedCandidate?.job_associations.length ? 'job' : 'independent'}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < savedCandidates.length - 1}
        onNavigatePrev={() => selectedIndex !== null && selectedIndex > 0 && setSelectedIndex(selectedIndex - 1)}
        onNavigateNext={() => selectedIndex !== null && selectedIndex < savedCandidates.length - 1 && setSelectedIndex(selectedIndex + 1)}
      />
    </>
  )
}
