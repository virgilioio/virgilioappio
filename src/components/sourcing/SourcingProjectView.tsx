import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { CandidatesTab } from './CandidatesTab'
import { ConversationTab } from './ConversationTab'
import { SavedCandidatesTab } from './SavedCandidatesTab'
import { ArchivedCandidatesTab } from './ArchivedCandidatesTab'
import { AddCollectedToPipelineDialog } from './AddCollectedToPipelineDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useSourcingProject } from '@/hooks/useSourcingProject'
import { useSourcingProjectCandidates } from '@/hooks/useSourcingProjectCandidates'
import { useSavedCandidates } from '@/hooks/useSavedCandidates'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { SourcingProjectFilters, SearchCriteria, SourcingProject } from '@/types/sourcing'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

export interface SourcingProjectActions {
  onRefresh: () => Promise<void>
  onArchive: () => Promise<void>
  onDelete: () => Promise<void>
  onVisibilityToggle: (isPublic: boolean) => Promise<void>
  onLinkToJob: (jobId: string) => Promise<void>
}

interface SourcingProjectViewProps {
  projectId: string
  filters: SourcingProjectFilters
  onFiltersChange: (filters: SourcingProjectFilters) => void
  isRefreshing: boolean
  setIsRefreshing: (v: boolean) => void
  onProjectLoaded?: (project: any) => void
  onUpdateSearchCriteria?: (fn: ((criteria: SearchCriteria) => Promise<void>) | null) => void
  onExposeActions?: (actions: SourcingProjectActions | null) => void
}


export function SourcingProjectView({ 
  projectId, 
  filters, 
  onFiltersChange,
  isRefreshing,
  setIsRefreshing,
  onProjectLoaded,
  onUpdateSearchCriteria: exposeUpdateSearchCriteria,
  onExposeActions
}: SourcingProjectViewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useSourcingProject(projectId)
  const { 
    candidates, 
    matchingResult,
    isLoading: candidatesLoading, 
    refetch: refetchCandidates 
  } = useSourcingProjectCandidates({
    projectId,
    enabled: !!projectId
  })
  
  const { data: savedCandidates = [] } = useSavedCandidates({
    projectId,
    enabled: !!projectId
  })
  
  const { data: archivedCandidates = [] } = useSavedCandidates({
    projectId,
    enabled: !!projectId,
    status: 'archived'
  })
  
  const [activeTab, setActiveTab] = useState('candidates')
  
  const [showAddToPipelineDialog, setShowAddToPipelineDialog] = useState(false)
  const [pendingJobId, setPendingJobId] = useState<string | null>(null)
  
  const { createAssociationAndMove } = usePipelineActions()

  useEffect(() => {
    if (project && onProjectLoaded) {
      onProjectLoaded(project)
    }
  }, [project, onProjectLoaded])

  const handleUpdateSearchCriteria = async (newCriteria: SearchCriteria) => {
    if (!project) return
    setIsRefreshing(true)

    queryClient.setQueryData(['sourcing-project', projectId], (old: any) =>
      old ? { 
        ...old, 
        search_criteria: newCriteria, 
        updated_at: new Date().toISOString() 
      } : old
    )

    try {
      const { data, error } = await supabase
        .from('sourcing_projects')
        .update({
          search_criteria: newCriteria as any,
          updated_at: new Date().toISOString(),
          sourcing_cache_expires_at: null,
          pdl_cache_expires_at: null,
          sourcing_candidate_count: 0,
        })
        .eq('id', projectId)
        .select('id, search_criteria, updated_at, sourcing_cache_expires_at, sourcing_candidate_count')
        .single()

      if (error) throw error

      queryClient.setQueryData(['sourcing-project', projectId], (old: any) =>
        old ? { ...old, ...(data as object) } : data
      )

      await refetchCandidates()

      toast.success('Search Updated', { description: 'Candidates refreshed with updated criteria.' })
    } catch (error: any) {
      console.error('Error updating search criteria:', error)
      toast.error('Failed to Update Search', { description: error.message })
      await queryClient.refetchQueries({ queryKey: ['sourcing-project', projectId] })
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (exposeUpdateSearchCriteria) {
      exposeUpdateSearchCriteria(project ? handleUpdateSearchCriteria : null)
    }
  }, [project, projectId])

  useEffect(() => {
    if (onExposeActions) {
      onExposeActions(project ? {
        onRefresh: handleRefresh,
        onArchive: handleArchive,
        onDelete: handleDelete,
        onVisibilityToggle: handleVisibilityToggle,
        onLinkToJob: handleLinkToJob,
      } : null)
    }
  }, [project, projectId])
  
  const filteredCandidates = useMemo(() => {
    if (!candidates) return []
    
    return candidates.filter(candidate => {
      if (filters.matchTiers && filters.matchTiers.length > 0) {
        if (!filters.matchTiers.includes(candidate.match_tier as any)) {
          return false
        }
      }
      
      const totalExp = candidate.experience_years || 0
      if (totalExp < (filters.minExperience || 0) || totalExp > (filters.maxExperience || 30)) {
        return false
      }

      if (filters.source && filters.source !== 'all') {
        if (filters.source === 'local' && candidate.source !== 'local') return false
        if (filters.source === 'apollo' && candidate.source !== 'apollo') return false
        if (filters.source === 'pdl' && candidate.source !== 'pdl') return false
      }

      if (filters.hasEmail === true && !candidate.has_email) return false
      if (filters.hasPhone === true && !candidate.has_phone) return false

      if (filters.candidateSource && filters.candidateSource.length > 0 && filters.candidateSource.length < 3) {
        const wantInternal = filters.candidateSource.includes('internal')
        const wantGio = filters.candidateSource.includes('gio')
        const wantExternal = filters.candidateSource.includes('external')
        
        const ds = (candidate as any).display_source ||
          (candidate.source === 'apollo' && candidate.is_preview === false && !!candidate.candidate_id && !candidate.is_gio_sourced ? 'internal' :
           candidate.is_gio_sourced ? 'gio' :
           candidate.source === 'pdl' ? 'pdl' : 'apollo')
        const isInternal = ds === 'internal'
        const isGio = ds === 'gio'
        const isExternal = ds === 'apollo' || ds === 'pdl'
        
        const matches = (wantInternal && isInternal) || (wantGio && isGio) || (wantExternal && isExternal)
        if (!matches) return false
      }
      
      return true
    })
  }, [candidates, filters])
  
  const handleSaveName = async (name: string) => {
    if (!project || !name.trim()) return
    
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ name })
      .eq('id', project.id)
    
    if (error) {
      toast.error('Failed to update name', { description: error.message })
    } else {
      toast.success('Project name updated')
      refetchProject()
    }
  }
  
  const handleArchive = async () => {
    if (!project) return
    
    const newStatus = project.status === 'active' ? 'archived' : 'active'
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ status: newStatus })
      .eq('id', project.id)
    
    if (error) {
      toast.error('Failed to update status', { description: error.message })
    } else {
      toast.success(`Project ${newStatus === 'archived' ? 'archived' : 'unarchived'}`)
      refetchProject()
    }
  }
  
  const handleDelete = async () => {
    if (!project || !confirm('Are you sure you want to delete this project?')) return
    
    const { error } = await supabase
      .from('sourcing_projects')
      .delete()
      .eq('id', project.id)
    
    if (error) {
      toast.error('Failed to delete project', { description: error.message })
    } else {
      toast.success('Project deleted')
      queryClient.invalidateQueries({ queryKey: ['sourcing-projects'] })
      navigate('/find')
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchCandidates()
    setIsRefreshing(false)
  }

  const handleVisibilityToggle = async (isPublic: boolean) => {
    if (!project) return
    
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ is_public: isPublic })
      .eq('id', project.id)
    
    if (error) {
      toast.error('Failed to update visibility', { description: error.message })
    } else {
      toast.success(
        isPublic 
          ? 'Project is now visible to your organization' 
          : 'Project is now private'
      )
      refetchProject()
    }
  }

  const linkProjectToJob = async (jobId: string | null) => {
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ job_id: jobId })
      .eq('id', project!.id)
    
    if (error) {
      toast.error(jobId ? 'Failed to link job' : 'Failed to unlink job', { description: error.message })
      return false
    }
    toast.success(jobId ? 'Project linked to job' : 'Project unlinked')
    refetchProject()
    return true
  }

  const [lastLinkResult, setLastLinkResult] = useState<{ stageJhsId: string | null; stageName: string | null; movedCount: number } | null>(null)

  const handleLinkToJob = async (input: any) => {
    if (!project) return
    // Legacy: string payload (used by header/actions for unlink, signaled by empty string)
    if (typeof input === 'string') {
      if (!input) { await linkProjectToJob(null); return }
      await linkProjectToJob(input)
      return
    }

    const payload = input as { jobId: string; stageJhsId: string | null; stageName: string | null; backfill: boolean; careersLink: boolean }
    const linked = await linkProjectToJob(payload.jobId)
    if (!linked) return

    let moved = 0
    if (payload.backfill && payload.stageJhsId && savedCandidates && savedCandidates.length > 0) {
      for (const candidate of savedCandidates) {
        try {
          await createAssociationAndMove(payload.jobId, candidate.id, payload.stageJhsId)
          moved++
        } catch (error) {
          console.error('Failed to backfill candidate:', error)
        }
      }
      if (moved > 0) toast.success(`Moved ${moved} candidate${moved !== 1 ? 's' : ''} into ${payload.stageName || 'pipeline'}`)
    }

    if (payload.careersLink) {
      await supabase.from('sourcing_projects').update({ send_careers_link: true }).eq('id', project.id)
    }

    setLastLinkResult({ stageJhsId: payload.stageJhsId, stageName: payload.stageName, movedCount: moved })
  }

  const handleAddToPipelineConfirm = async (stageId: string) => {
    if (!pendingJobId) return
    
    const linked = await linkProjectToJob(pendingJobId)
    if (!linked) {
      setShowAddToPipelineDialog(false)
      setPendingJobId(null)
      return
    }
    
    let successCount = 0
    let failCount = 0
    
    for (const candidate of savedCandidates) {
      try {
        await createAssociationAndMove(pendingJobId, candidate.id, stageId)
        successCount++
      } catch (error) {
        console.error('Failed to add candidate to pipeline:', error)
        failCount++
      }
    }
    
    if (successCount > 0) {
      toast.success(`Added ${successCount} candidate${successCount !== 1 ? 's' : ''} to pipeline`)
    }
    if (failCount > 0) {
      toast.error(`Failed to add ${failCount} candidate${failCount !== 1 ? 's' : ''}`)
    }
    
    setShowAddToPipelineDialog(false)
    setPendingJobId(null)
  }

  const handleAddToPipelineSkip = async () => {
    if (!pendingJobId) return
    
    await linkProjectToJob(pendingJobId)
    setShowAddToPipelineDialog(false)
    setPendingJobId(null)
  }

  
  if (projectLoading) {
    return <div className="flex items-center justify-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  }
  
  if (!project) {
    return <div className="p-8 text-center text-muted-foreground">
      Project not found
    </div>
  }
  
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <CandidatesTab
        project={project}
        candidates={filteredCandidates as any}
        isLoading={candidatesLoading}
        jobId={project.job_id}
        projectId={project.id}
        searchCriteria={project.search_criteria}
        sourceBreakdown={matchingResult?.source_breakdown}
        onLinkToJob={handleLinkToJob}
        onUnlinkJob={async () => { await linkProjectToJob(null) }}
        savedCandidatesCount={savedCandidates?.length ?? 0}
        lastLinkResult={lastLinkResult}
      />

      {pendingJobId && (
        <AddCollectedToPipelineDialog
          open={showAddToPipelineDialog}
          onOpenChange={setShowAddToPipelineDialog}
          jobId={pendingJobId}
          candidateCount={savedCandidates.length}
          onConfirm={handleAddToPipelineConfirm}
          onSkip={handleAddToPipelineSkip}
        />
      )}
    </div>
  )
}
