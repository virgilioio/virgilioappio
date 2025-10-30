import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { 
  Edit2, MoreHorizontal, RefreshCw, Archive, Trash2, 
  MapPin, DollarSign 
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SourcingProject, SourcingProjectFilters } from '@/types/sourcing'
import { cn } from '@/lib/utils'

interface SourcingProjectHeaderProps {
  project: SourcingProject
  breakdown: {
    excellent: number
    good: number
    fair: number
    minimal: number
  }
  filters: SourcingProjectFilters
  onFiltersChange: (filters: SourcingProjectFilters) => void
  onRefresh: () => void
  onArchive: () => void
  onDelete: () => void
  onNameUpdate: (name: string) => void
}

export function SourcingProjectHeader({
  project,
  breakdown,
  filters,
  onFiltersChange,
  onRefresh,
  onArchive,
  onDelete,
  onNameUpdate
}: SourcingProjectHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState(project.name)

  const handleSaveName = () => {
    if (editedName.trim()) {
      onNameUpdate(editedName)
      setIsEditingName(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Project Name & Actions */}
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
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Results
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {project.status === 'active' ? 'Archive' : 'Unarchive'} Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Compact Search Criteria, Match Breakdown & Filters */}
      <Card className="shadow-calendly">
        <CardContent className="p-6 space-y-4">
          {/* Search Criteria Summary - Single Line */}
          {project.search_criteria && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {project.search_criteria.skills && project.search_criteria.skills.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">🎯 Skills:</span>
                  <div className="flex flex-wrap gap-1">
                    {project.search_criteria.skills.slice(0, 3).map(skill => (
                      <Badge key={skill} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {project.search_criteria.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{project.search_criteria.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {project.search_criteria.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{project.search_criteria.location}</span>
                </div>
              )}
              
              {project.search_criteria.salary_min && project.search_criteria.salary_max && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {project.search_criteria.currency} {project.search_criteria.salary_min.toLocaleString()} - {project.search_criteria.salary_max.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Match Breakdown - Inline Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Matches:</span>
            <Badge className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30">
              ⭐ {breakdown.excellent} Excellent
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30 hover:bg-blue-500/30">
              ⭐ {breakdown.good} Good
            </Badge>
            <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 hover:bg-yellow-500/30">
              ⭐ {breakdown.fair} Fair
            </Badge>
            <Badge variant="secondary">
              {breakdown.minimal} Minimal
            </Badge>
          </div>

          {/* Filters Row */}
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Filters</Label>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onFiltersChange({
                  matchTiers: [],
                  location: '',
                  minExperience: 0,
                  maxExperience: 30
                })}
              >
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Match Tier */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Match Tier</Label>
                <div className="flex flex-wrap gap-2">
                  {(['excellent', 'good', 'fair', 'minimal'] as const).map(tier => (
                    <label key={tier} className="flex items-center gap-1 cursor-pointer">
                      <Checkbox 
                        checked={filters.matchTiers?.includes(tier)}
                        onCheckedChange={(checked) => {
                          onFiltersChange({
                            ...filters,
                            matchTiers: checked 
                              ? [...(filters.matchTiers || []), tier]
                              : (filters.matchTiers || []).filter(t => t !== tier)
                          })
                        }}
                      />
                      <span className="text-xs capitalize">{tier}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Location</Label>
                <Input 
                  placeholder="Filter by location..."
                  value={filters.location || ''}
                  onChange={(e) => onFiltersChange({ ...filters, location: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              {/* Experience Range */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Experience (years)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number"
                    value={filters.minExperience || 0}
                    onChange={(e) => onFiltersChange({ ...filters, minExperience: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm w-20"
                    min={0}
                    max={30}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input 
                    type="number"
                    value={filters.maxExperience || 30}
                    onChange={(e) => onFiltersChange({ ...filters, maxExperience: parseInt(e.target.value) || 30 })}
                    className="h-9 text-sm w-20"
                    min={0}
                    max={30}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
