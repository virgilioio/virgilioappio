import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { CandidatesTab } from './CandidatesTab'
import { ConversationTab } from './ConversationTab'
import { SavedCandidatesTab } from './SavedCandidatesTab'
import { ArchivedCandidatesTab } from './ArchivedCandidatesTab'
import { AddCollectedToPipelineDialog } from './AddCollectedToPipelineDialog'
import { SavedSearchSelector } from './SavedSearchSelector'
import { Tabs, TabsContent } from '@/components/ui/tabs'
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

const tabConfig = [
  { 
    value: 'conversation', 
    label: 'Chat with Gio', 
    icon: Sparkles,
    activeClasses: 'bg-gradient-to-r from-blue-400/90 to-purple-400/90 text-white shadow-md',
    inactiveClasses: 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:hover:bg-blue-900/40',
  },
  { 
    value: 'candidates', 
    label: 'Candidates', 
    icon: Users,
    activeClasses: 'bg-[#d7c5fb] text-[#0d0d09] shadow-md dark:bg-purple-500/80 dark:text-white',
    inactiveClasses: 'bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-300 dark:hover:bg-purple-900/40',
    showCount: true,
  },
  { 
    value: 'saved', 
    label: 'Saved', 
    icon: UserCheck,
    activeClasses: 'bg-amber-200 text-amber-900 shadow-md dark:bg-amber-500/80 dark:text-white',
    inactiveClasses: 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40',
    showCount: true,
  },
  { 
    value: 'archived', 
    label: 'Archived', 
    icon: Archive,
    activeClasses: 'bg-sky-200 text-sky-900 shadow-md dark:bg-sky-500/80 dark:text-white',
    inactiveClasses: 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-900/40',
    showCount: true,
  },
]

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

  const getTabCount = (value: string) => {
    switch (value) {
      case 'candidates': return filteredCandidates.length
      case 'saved': return savedCandidates.length
      case 'archived': return archivedCandidates.length
      default: return 0
    }
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
        {/* Colorful pipeline-style tabs */}
        <div className="border-b bg-background shrink-0">
          <div className="px-4 py-3">
            <div className="inline-flex items-center gap-1.5 rounded-xl p-1.5 bg-[#fffcf9] dark:bg-surface-secondary/50 shadow-[var(--shadow-xs)] border border-virgilio-border/20">
              {tabConfig.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.value
                const count = tab.showCount ? getTabCount(tab.value) : 0
                
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-poppins font-medium tracking-tight transition-all duration-200 ease-out h-10 md:h-11 ${
                      isActive ? tab.activeClasses : tab.inactiveClasses
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                    {tab.showCount && count > 0 && (
                      <Badge 
                        variant={isActive ? "outline" : "secondary"} 
                        className={`ml-0.5 text-[10px] h-5 px-1.5 ${
                          isActive ? 'border-current/30 bg-white/20' : ''
                        }`}
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
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
