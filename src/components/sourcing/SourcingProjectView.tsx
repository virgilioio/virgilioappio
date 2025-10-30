import { useState, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSourcingProject } from '@/hooks/useSourcingProject'
import { useJobMatchingCandidates } from '@/hooks/useJobMatchingCandidates'
import { SourcingProjectHeader } from './SourcingProjectHeader'
import { SourcingCandidateTable } from './SourcingCandidateTable'
import { supabase } from '@/lib/supabaseClient'
import type { SourcingProjectFilters } from '@/types/sourcing'

interface SourcingProjectViewProps {
  projectId: string
}

export function SourcingProjectView({ projectId }: SourcingProjectViewProps) {
  const { toast } = useToast()
  const { data: project, isLoading: projectLoading } = useSourcingProject(projectId)
  const { 
    candidates, 
    isLoading: candidatesLoading, 
    refetch 
  } = useJobMatchingCandidates({
    jobId: project?.job_id || '',
    enabled: !!project?.job_id
  })
  
  const [filters, setFilters] = useState<SourcingProjectFilters>({
    matchTiers: [],
    location: '',
    minExperience: 0,
    maxExperience: 30
  })
  
  // Apply filters locally
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (filters.matchTiers && filters.matchTiers.length > 0 && !filters.matchTiers.includes(c.match_tier)) {
        return false
      }
      if (filters.location && !c.location_country?.toLowerCase().includes(filters.location.toLowerCase())) {
        return false
      }
      if (c.years_experience !== undefined && filters.minExperience !== undefined && filters.maxExperience !== undefined) {
        if (c.years_experience < filters.minExperience || c.years_experience > filters.maxExperience) {
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
      toast({
        title: 'Failed to update name',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      toast({ title: 'Project name updated' })
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
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      toast({ title: `Project ${newStatus === 'archived' ? 'archived' : 'unarchived'}` })
    }
  }
  
  const handleDelete = async () => {
    if (!project || !confirm('Are you sure you want to delete this project?')) return
    
    const { error } = await supabase
      .from('sourcing_projects')
      .delete()
      .eq('id', project.id)
    
    if (error) {
      toast({
        title: 'Failed to delete project',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      toast({ title: 'Project deleted' })
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
    <div className="space-y-6 animate-fade-in">
      <SourcingProjectHeader
        project={project}
        breakdown={breakdown}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refetch}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onNameUpdate={handleSaveName}
      />
      
      <SourcingCandidateTable
        candidates={filteredCandidates}
        isLoading={candidatesLoading}
        jobId={project.job_id}
      />
    </div>
  )
}
