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
import UniversalCandidateProfileSheet from '@/components/candidates/UniversalCandidateProfileSheet'
import { 
  Mail, 
  Phone, 
  Linkedin, 
  MapPin, 
  Building2, 
  Briefcase,
  ExternalLink,
  Archive,
  CheckSquare,
  X,
  ArrowRight,
  Loader2
} from 'lucide-react'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import { format } from 'date-fns'
import { toast } from 'sonner'

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

  // Load stages when entering selection mode (if project is linked to a job)
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
      if (options && options.length > 0) {
        setSelectedStageId(options[0].jhsId)
      }
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
      const newSet = new Set(prev)
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId)
      } else {
        newSet.add(candidateId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === savedCandidates.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(savedCandidates.map(c => c.id)))
    }
  }

  const handleMoveToPipeline = async () => {
    if (!jobId || !selectedStageId || selectedIds.size === 0) return
    
    setIsMovingToPipeline(true)
    let successCount = 0
    let failCount = 0
    
    const candidatesToMove = savedCandidates.filter(c => selectedIds.has(c.id))
    
    for (const candidate of candidatesToMove) {
      try {
        await createAssociationAndMove(jobId, candidate.id, selectedStageId)
        successCount++
      } catch (error) {
        console.error('Failed to move candidate:', error)
        failCount++
      }
    }
    
    if (successCount > 0) {
      toast.success(`Moved ${successCount} candidate${successCount !== 1 ? 's' : ''} to pipeline`)
    }
    if (failCount > 0) {
      toast.error(`Failed to move ${failCount} candidate${failCount !== 1 ? 's' : ''}`)
    }
    
    handleExitSelectionMode()
    refetch()
    setIsMovingToPipeline(false)
  }

  const handleCandidateClick = (index: number) => {
    if (selectionMode) return // Don't open sheet in selection mode
    setSelectedIndex(index)
    setSheetOpen(true)
  }

  const handleNavigatePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleNavigateNext = () => {
    if (selectedIndex !== null && selectedIndex < savedCandidates.length - 1) {
      setSelectedIndex(selectedIndex + 1)
    }
  }

  const handleArchive = (e: React.MouseEvent, candidate: SavedCandidate) => {
    e.stopPropagation()
    archiveCandidate({ apolloId: candidate.apollo_id!, projectId })
  }

  const formatLocation = (candidate: SavedCandidate) => {
    const parts = [
      candidate.location_city,
      candidate.location_state,
      candidate.location_country
    ].filter(Boolean)
    return parts.join(', ') || null
  }

  if (isLoading) {
    return (
      <Card className="shadow-calendly m-4">
        <CardContent className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (savedCandidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <img 
          src={gioFaceEmpty} 
          alt="No saved candidates" 
          className="w-24 h-24 mb-4"
        />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No candidates collected yet
        </h3>
        <p className="text-muted-foreground max-w-md">
          Candidates you reveal from the search results will appear here. 
          Go to the Candidates tab and click "Reveal Full Profile" to collect candidates.
        </p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="container mx-auto p-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            {selectionMode ? (
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExitSelectionMode}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedIds.size === savedCandidates.length ? 'Deselect All' : 'Select All'}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedStageId}
                    onValueChange={setSelectedStageId}
                    disabled={loadingStages || stageOptions.length === 0}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue
                        placeholder={
                          loadingStages
                            ? 'Loading...'
                            : stageOptions.length
                              ? 'Select stage'
                              : 'No stages'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((opt) => (
                        <SelectItem key={opt.jhsId} value={opt.jhsId}>
                          {opt.stage.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleMoveToPipeline}
                    disabled={selectedIds.size === 0 || !selectedStageId || isMovingToPipeline}
                  >
                    {isMovingToPipeline ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-1" />
                    )}
                    Move to Pipeline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {jobId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnterSelectionMode}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select Candidates
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Candidate List */}
          <div className="space-y-2">
            {savedCandidates.map((candidate, index) => (
              <div
                key={candidate.id}
                className={`flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors ${
                  selectionMode && selectedIds.has(candidate.id) ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => selectionMode ? handleToggleSelection({ stopPropagation: () => {} } as React.MouseEvent, candidate.id) : handleCandidateClick(index)}
              >
                {/* Checkbox for selection mode */}
                {selectionMode && (
                  <div className="mr-3" onClick={(e) => handleToggleSelection(e, candidate.id)}>
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={() => {}}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Name and Role */}
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground truncate">
                      {candidate.candidate_name}
                    </h4>
                    {candidate.linkedin_url && (
                      <a
                        href={candidate.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-virgilio-purple hover:text-virgilio-purple/80"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  
                  {/* Current Position */}
                  {(candidate.role_current || candidate.company_current) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      {candidate.role_current && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {candidate.role_current}
                        </span>
                      )}
                      {candidate.company_current && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {candidate.company_current}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contact & Location */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {candidate.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {candidate.email}
                      </span>
                    )}
                    {candidate.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {candidate.phone}
                      </span>
                    )}
                    {formatLocation(candidate) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {formatLocation(candidate)}
                      </span>
                    )}
                  </div>

                  {/* Job Associations */}
                  {candidate.job_associations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {candidate.job_associations.map((assoc, i) => (
                        <Badge 
                          key={i} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          {assoc.job_title}
                          {assoc.stage_name && (
                            <span className="ml-1 opacity-70">• {assoc.stage_name}</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Side - Date & Action */}
                {!selectionMode && (
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(candidate.apollo_collected_at), 'MMM d, yyyy')}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => handleArchive(e, candidate)}
                      disabled={isArchiving}
                      title="Archive candidate"
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Candidate Profile Sheet */}
      <UniversalCandidateProfileSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidateId={selectedCandidate?.id || null}
        jobId={selectedCandidate?.job_associations[0]?.job_id || null}
        context={selectedCandidate?.job_associations.length ? 'job' : 'independent'}
        hasPrev={selectedIndex !== null && selectedIndex > 0}
        hasNext={selectedIndex !== null && selectedIndex < savedCandidates.length - 1}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
      />
    </>
  )
}
