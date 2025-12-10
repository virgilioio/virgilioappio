import { useState, useMemo } from 'react'
import { Loader2, Sparkles, Users } from 'lucide-react'
import { SourcingProjectHeader } from './SourcingProjectHeader'
import { CandidatesTab } from './CandidatesTab'
import { ConversationTab } from './ConversationTab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useSourcingProject } from '@/hooks/useSourcingProject'
import { useSourcingProjectCandidates } from '@/hooks/useSourcingProjectCandidates'
import { SourcingProjectFilters, SearchCriteria } from '@/types/sourcing'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface SourcingProjectViewProps {
  projectId: string
}

export function SourcingProjectView({ projectId }: SourcingProjectViewProps) {
  const queryClient = useQueryClient()
  const { data: project, isLoading: projectLoading, refetch: refetchProject } = useSourcingProject(projectId)
  const { 
    candidates, 
    isLoading: candidatesLoading, 
    refetch: refetchCandidates 
  } = useSourcingProjectCandidates({
    projectId,
    enabled: !!projectId
  })
  
  const [filters, setFilters] = useState<SourcingProjectFilters>({
    matchTiers: [],
    minExperience: 0,
    maxExperience: 30,
    source: 'all'
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('candidates')
  
  // Apply filters locally
  const filteredCandidates = useMemo(() => {
    if (!candidates) return []
    
    return candidates.filter(candidate => {
      // Match tier filter
      if (filters.matchTiers && filters.matchTiers.length > 0) {
        if (!filters.matchTiers.includes(candidate.match_tier as any)) {
          return false
        }
      }
      
      // Experience filter
      const totalExp = candidate.experience_years || 0
      if (totalExp < (filters.minExperience || 0) || totalExp > (filters.maxExperience || 30)) {
        return false
      }

      // Source filter
      if (filters.source && filters.source !== 'all') {
        if (filters.source === 'local' && candidate.source !== 'local') {
          return false
        }
        if (filters.source === 'apollo' && candidate.source !== 'apollo') {
          return false
        }
      }
      
      return true
    })
  }, [candidates, filters])
  
  // Group by match tier for breakdown
  const breakdown = useMemo(() => {
    return {
      excellent: filteredCandidates.filter(c => c.match_tier === 'excellent').length,
      good: filteredCandidates.filter(c => c.match_tier === 'good').length,
      fair: filteredCandidates.filter(c => c.match_tier === 'fair').length,
      minimal: filteredCandidates.filter(c => c.match_tier === 'minimal').length
    }
  }, [filteredCandidates])
  
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
    }
  }

  const handleUpdateSearchCriteria = async (newCriteria: SearchCriteria) => {
    if (!project) return
    setIsRefreshing(true)

    // 1. Optimistically update cache IMMEDIATELY (no stale window)
    queryClient.setQueryData(['sourcing-project', projectId], (old: any) =>
      old ? { 
        ...old, 
        search_criteria: newCriteria, 
        updated_at: new Date().toISOString() 
      } : old
    )

    try {
      // 2. Persist to DB and RETURN the updated row (critical for reconciliation)
      const { data, error } = await supabase
        .from('sourcing_projects')
        .update({
          search_criteria: newCriteria as any,
          updated_at: new Date().toISOString(),
          coresignal_cache_expires_at: null,
          coresignal_candidate_count: 0,
        })
        .eq('id', projectId)
        .select('id, search_criteria, updated_at, coresignal_cache_expires_at, coresignal_candidate_count')
        .single()

      if (error) throw error

      // 3. Reconcile cache with authoritative server result
      queryClient.setQueryData(['sourcing-project', projectId], (old: any) =>
        old ? { ...old, ...data } : data
      )

      // 4. Now refresh dependent data (candidates) after cache is consistent
      await refetchCandidates()

      toast.success('Search Updated', { description: 'Candidates refreshed with updated criteria.' })
    } catch (error: any) {
      console.error('Error updating search criteria:', error)
      toast.error('Failed to Update Search', { description: error.message })
      
      // Rollback: refetch to get server truth
      await queryClient.refetchQueries({ queryKey: ['sourcing-project', projectId] })
    } finally {
      setIsRefreshing(false)
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Header Section */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="container mx-auto p-4">
          <SourcingProjectHeader 
            project={project}
            breakdown={breakdown}
            onRefresh={handleRefresh}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onNameUpdate={handleSaveName}
            onVisibilityToggle={handleVisibilityToggle}
          />
        </div>
      </div>
      
      {/* Tabs Section */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="border-b bg-background">
          <div className="container mx-auto px-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="conversation" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Chat with Gio
              </TabsTrigger>
              <TabsTrigger value="candidates" className="gap-2">
                <Users className="h-4 w-4" />
                Candidates
                {filteredCandidates.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {filteredCandidates.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        
        <TabsContent value="conversation" className="flex-1 overflow-hidden m-0">
          <ConversationTab 
            projectId={projectId}
            onRefinementComplete={() => setActiveTab('candidates')}
          />
        </TabsContent>
        
        <TabsContent value="candidates" className="flex-1 overflow-hidden m-0">
          <CandidatesTab 
            project={project}
            candidates={filteredCandidates}
            filters={filters}
            onFiltersChange={setFilters}
            onUpdateSearchCriteria={handleUpdateSearchCriteria}
            isRefreshing={isRefreshing}
            isLoading={candidatesLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
