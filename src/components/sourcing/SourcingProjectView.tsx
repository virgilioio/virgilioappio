import { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { SourcingProjectHeader } from './SourcingProjectHeader'
import { SourcingCandidateTable } from './SourcingCandidateTable'
import { SourcingFiltersPanel } from './SourcingFiltersPanel'
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
        if (filters.source === 'coresignal' && candidate.source !== 'coresignal') {
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
    
    try {
      // 1. Update sourcing_project record with new search_criteria and invalidate cache
      const { error: updateError } = await supabase
        .from('sourcing_projects')
        .update({ 
          search_criteria: newCriteria as any,
          updated_at: new Date().toISOString(),
          // Invalidate CoreSignal cache to force fresh search
          coresignal_cache_expires_at: null,
          coresignal_candidate_count: 0
        })
        .eq('id', projectId)
      
      if (updateError) throw updateError
      
      // 2. Refresh the project data
      await refetchProject()
      
      // 3. Refetch candidates with new criteria (the hook will use updated project data)
      await refetchCandidates()
      
      toast.success('Search Updated', { description: 'Candidates refreshed with updated criteria.' })
    } catch (error: any) {
      console.error('Error updating search criteria:', error)
      toast.error('Failed to Update Search', { description: error.message })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refetchCandidates()
    setIsRefreshing(false)
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
    <div className="flex h-screen overflow-hidden">
      <SourcingFiltersPanel 
        filters={filters}
        onFiltersChange={setFilters}
        project={project}
        onUpdateSearchCriteria={handleUpdateSearchCriteria}
        isRefreshing={isRefreshing}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
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
            />
          </div>
        </div>
        
        {/* Scrollable Candidate Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4">
            <SourcingCandidateTable 
              candidates={filteredCandidates}
              isLoading={candidatesLoading}
              jobId={project.job_id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
