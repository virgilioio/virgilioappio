import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Edit2, MoreHorizontal, RefreshCw, Archive, Trash2, 
  Loader2, MapPin, DollarSign, Users 
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { useSourcingProject } from '@/hooks/useSourcingProject'
import { useJobMatchingCandidates } from '@/hooks/useJobMatchingCandidates'
import { SourcingCandidateCard } from './SourcingCandidateCard'
import { supabase } from '@/lib/supabaseClient'

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
  
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [filters, setFilters] = useState({
    matchTiers: [] as ('excellent' | 'good' | 'fair' | 'minimal')[],
    location: '',
    minExperience: 0,
    maxExperience: 30
  })
  
  // Apply filters locally
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (filters.matchTiers.length > 0 && !filters.matchTiers.includes(c.match_tier)) {
        return false
      }
      if (filters.location && !c.location_country?.toLowerCase().includes(filters.location.toLowerCase())) {
        return false
      }
      if (c.years_experience !== undefined) {
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
  
  const handleSaveName = async () => {
    if (!project || !editedName.trim()) return
    
    const { error } = await supabase
      .from('sourcing_projects')
      .update({ name: editedName })
      .eq('id', project.id)
    
    if (error) {
      toast({
        title: 'Failed to update name',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      setIsEditingName(false)
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
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input 
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="max-w-md"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveName}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditingName(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-h3-mobile sm:text-h3-desktop font-poppins font-bold text-foreground tracking-page-title">
                {project.name}<span className="text-purple-period">.</span>
              </h1>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0"
                onClick={() => {
                  setEditedName(project.name)
                  setIsEditingName(true)
                }}
              >
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
            {project.last_search_at && (
              <span className="text-sm text-muted-foreground">
                Last updated {formatDistanceToNow(new Date(project.last_search_at))} ago
              </span>
            )}
          </div>
        </div>
        
        {/* Action Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Results
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {project.status === 'active' ? 'Archive' : 'Unarchive'} Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Search Criteria Summary */}
      {project.search_criteria && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Search Criteria</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Skills */}
              {project.search_criteria.skills && project.search_criteria.skills.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Skills</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {project.search_criteria.skills.map(skill => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Location */}
              {project.search_criteria.location && (
                <div>
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{project.search_criteria.location}</span>
                  </div>
                </div>
              )}
              
              {/* Salary Range */}
              {project.search_criteria.salary_min && project.search_criteria.salary_max && (
                <div>
                  <Label className="text-xs text-muted-foreground">Salary Range</Label>
                  <div className="flex items-center gap-1 mt-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">
                      {project.search_criteria.currency} {project.search_criteria.salary_min.toLocaleString()} - {project.search_criteria.salary_max.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Match Breakdown + Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Match Breakdown */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg">Match Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-success-foreground">{breakdown.excellent}</div>
                <div className="text-xs text-muted-foreground">Excellent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info-foreground">{breakdown.good}</div>
                <div className="text-xs text-muted-foreground">Good</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{breakdown.fair}</div>
                <div className="text-xs text-muted-foreground">Fair</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground">{breakdown.minimal}</div>
                <div className="text-xs text-muted-foreground">Minimal</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Filters Card */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Filters</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setFilters({
                  matchTiers: [],
                  location: '',
                  minExperience: 0,
                  maxExperience: 30
                })}
              >
                Reset
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Match Tier Checkboxes */}
            <div>
              <Label className="text-xs">Match Tier</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(['excellent', 'good', 'fair', 'minimal'] as const).map(tier => (
                  <label key={tier} className="flex items-center gap-1 cursor-pointer">
                    <Checkbox 
                      checked={filters.matchTiers.includes(tier)}
                      onCheckedChange={(checked) => {
                        setFilters(prev => ({
                          ...prev,
                          matchTiers: checked 
                            ? [...prev.matchTiers, tier]
                            : prev.matchTiers.filter(t => t !== tier)
                        }))
                      }}
                    />
                    <span className="text-xs capitalize">{tier}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Location Filter */}
            <div>
              <Label className="text-xs">Location</Label>
              <Input 
                placeholder="Filter by location..."
                value={filters.location}
                onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                className="h-8 text-sm mt-1"
              />
            </div>
            
            {/* Experience Range */}
            <div>
              <Label className="text-xs">Experience (years)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  type="number"
                  value={filters.minExperience}
                  onChange={(e) => setFilters(prev => ({ ...prev, minExperience: parseInt(e.target.value) || 0 }))}
                  className="h-8 text-sm w-16"
                  min={0}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input 
                  type="number"
                  value={filters.maxExperience}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxExperience: parseInt(e.target.value) || 30 }))}
                  className="h-8 text-sm w-16"
                  min={0}
                  max={30}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Candidates Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {filteredCandidates.length} Candidates
          </h2>
        </div>
        
        {candidatesLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        )}
        
        {!candidatesLoading && filteredCandidates.length === 0 && (
          <Card className="p-12 text-center">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search criteria or filters
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>• Broaden skill requirements</p>
              <p>• Adjust salary range</p>
              <p>• Expand location scope</p>
            </div>
          </Card>
        )}
        
        {!candidatesLoading && filteredCandidates.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCandidates.map(candidate => (
              <SourcingCandidateCard 
                key={candidate.id}
                candidate={candidate}
                jobId={project.job_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
