import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { CandidatesTab } from './CandidatesTab'
import { ConversationTab } from './ConversationTab'
import { SavedCandidatesTab } from './SavedCandidatesTab'
import { ArchivedCandidatesTab } from './ArchivedCandidatesTab'
import { AddCollectedToPipelineDialog } from './AddCollectedToPipelineDialog'
import { SavedSearchSelector } from './SavedSearchSelector'
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

interface SourcingProjectViewProps {
  projectId: string
  filters: SourcingProjectFilters
  onFiltersChange: (filters: SourcingProjectFilters) => void
  isRefreshing: boolean
  setIsRefreshing: (v: boolean) => void
  onProjectLoaded?: (project: any) => void
  onUpdateSearchCriteria?: (fn: ((criteria: SearchCriteria) => Promise<void>) | null) => void
}


export function SourcingProjectView({ 
  projectId, 
  filters, 
  onFiltersChange,
  isRefreshing,
  setIsRefreshing,
  onProjectLoaded,
  onUpdateSearchCriteria: exposeUpdateSearchCriteria
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
      }

      if (filters.hasEmail === true && !candidate.has_email) return false
      if (filters.hasPhone === true && !candidate.has_phone) return false
      
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

  const linkProjectToJob = async (jobId: string) => {
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ job_id: jobId })
      .eq('id', project!.id)
    
    if (error) {
      toast.error('Failed to link job', { description: error.message })
      return false
    }
    toast.success('Project linked to job')
    refetchProject()
    return true
  }

  const handleLinkToJob = async (jobId: string) => {
    if (!project) return
    
    if (savedCandidates && savedCandidates.length > 0) {
      setPendingJobId(jobId)
      setShowAddToPipelineDialog(true)
      return
    }
    
    await linkProjectToJob(jobId)
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

      {/* Tabs Section */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
      >
        {/* Colorful pipeline-style tabs — exact match to JobDetail */}
        <div className="border-b bg-background shrink-0 px-4 py-3">
          <TabsList className="grid w-full h-14 p-2 gap-1 grid-cols-4">
            <TabsTrigger 
              value="conversation"
              className="h-10 md:h-12 text-xs md:text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-text-primary data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white border border-blue-500/20 data-[state=active]:border-blue-500 data-[state=active]:shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(147,51,234,0.3)] data-[state=active]:animate-pulse"
            >
              <span className="flex items-center gap-1 truncate">
                <Sparkles className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                <span className="truncate">Chat with Gio</span>
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="candidates"
              className="h-10 md:h-12 text-xs md:text-sm bg-pastel-purple/20 text-text-primary data-[state=active]:bg-pastel-purple"
            >
              <span className="flex items-center gap-1 truncate">
                <span className="truncate">Candidates</span>
                {filteredCandidates.length > 0 && (
                  <Badge variant="pastel-purple" className="text-xs flex-shrink-0">{filteredCandidates.length}</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="saved"
              className="h-10 md:h-12 text-xs md:text-sm bg-pastel-yellow/20 text-text-primary data-[state=active]:bg-pastel-yellow"
            >
              <span className="flex items-center gap-1 truncate">
                <span className="truncate">Saved</span>
                {savedCandidates.length > 0 && (
                  <Badge variant="pastel-yellow" className="text-xs flex-shrink-0">{savedCandidates.length}</Badge>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger 
              value="archived"
              className="h-10 md:h-12 text-xs md:text-sm bg-pastel-blue/20 text-text-primary data-[state=active]:bg-pastel-blue"
            >
              <span className="flex items-center gap-1 truncate">
                <span className="truncate">Archived</span>
                {archivedCandidates.length > 0 && (
                  <Badge variant="pastel-blue" className="text-xs flex-shrink-0">{archivedCandidates.length}</Badge>
                )}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="conversation" className="flex-1 min-h-0 overflow-hidden m-0">
          <ConversationTab 
            projectId={projectId}
            onRefinementComplete={() => setActiveTab('candidates')}
          />
        </TabsContent>
        
        <TabsContent value="candidates" className="flex-1 min-h-0 overflow-hidden m-0">
          <CandidatesTab 
            project={project}
            candidates={filteredCandidates}
            isLoading={candidatesLoading}
            onRefresh={handleRefresh}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onVisibilityToggle={handleVisibilityToggle}
            onLinkToJob={handleLinkToJob}
            isRefreshing={isRefreshing}
            sourceBreakdown={matchingResult?.source_breakdown}
          />
        </TabsContent>
        
        <TabsContent value="saved" className="flex-1 min-h-0 overflow-hidden m-0">
          <SavedCandidatesTab projectId={projectId} jobId={project.job_id} />
        </TabsContent>
        
        <TabsContent value="archived" className="flex-1 min-h-0 overflow-hidden m-0">
          <ArchivedCandidatesTab projectId={projectId} />
        </TabsContent>
      </Tabs>

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
