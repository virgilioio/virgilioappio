import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SourcingProjectFilters, SourcingProject, SearchCriteria } from '@/types/sourcing'
import { Loader2, RefreshCw } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { EditableSearchCriteria } from './EditableSearchCriteria'

interface SourcingFiltersPanelProps {
  filters: SourcingProjectFilters
  onFiltersChange: (filters: SourcingProjectFilters) => void
  project: SourcingProject
  onUpdateSearchCriteria: (criteria: SearchCriteria) => Promise<void>
  isRefreshing: boolean
}

export function SourcingFiltersPanel({
  filters,
  onFiltersChange,
  project,
  onUpdateSearchCriteria,
  isRefreshing
}: SourcingFiltersPanelProps) {
  const [isEditingCriteria, setIsEditingCriteria] = useState(false)
  const [editableCriteria, setEditableCriteria] = useState<SearchCriteria>(project.search_criteria)

  // Seed editableCriteria once when entering edit mode
  const handleStartEdit = () => {
    setEditableCriteria(project.search_criteria)
    setIsEditingCriteria(true)
  }

  const handleSaveAndRefresh = async () => {
    // Apollo uses title_keywords as primary filter, not skills
    if (!editableCriteria.title_keywords || editableCriteria.title_keywords.length === 0) return
    setIsEditingCriteria(false)
    await onUpdateSearchCriteria(editableCriteria)
  }

  const handleCancelEdit = () => {
    setEditableCriteria(project.search_criteria)
    setIsEditingCriteria(false)
  }

  // Check if save is disabled (need at least title keywords for Apollo)
  const isSaveDisabled = isRefreshing || !editableCriteria.title_keywords || editableCriteria.title_keywords.length === 0

  return (
    <div className="w-80 h-full border-r border-virgilio-border/50 bg-surface-primary flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-b from-virgilio-purple/5 to-transparent border-b border-virgilio-border/30 bg-surface-primary flex-shrink-0">
        <h2 className="text-lg font-semibold text-virgilio-text">
          Search & Filters<span className="text-virgilio-purple">.</span>
        </h2>
      </div>

      <div className="px-4 py-4 space-y-4 overflow-y-auto flex-1">
        {/* Search Criteria Section */}
        <div className="space-y-4 p-4 rounded-xl bg-gradient-to-b from-virgilio-purple/5 to-transparent border border-virgilio-border/30 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-virgilio-text">Search Criteria</h3>
            {!isEditingCriteria ? (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleStartEdit}
                className="h-8 px-3 text-xs rounded-lg transition-all duration-200 hover:bg-virgilio-purple/10 hover:text-virgilio-text hover:shadow-sm"
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCancelEdit} 
                  className="h-8 px-3 text-xs rounded-lg transition-all duration-200 hover:bg-muted hover:shadow-sm"
                >
                  Cancel
                </Button>
                <Button 
                  size="sm" 
                  onClick={handleSaveAndRefresh} 
                  disabled={isSaveDisabled}
                  className="h-8 px-3 text-xs rounded-lg text-white bg-gradient-to-r from-virgilio-purple to-virgilio-purple/90 hover:shadow-md transition-all duration-200"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      Save & Refresh
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {isEditingCriteria ? (
            <EditableSearchCriteria 
              criteria={editableCriteria} 
              onChange={setEditableCriteria} 
            />
          ) : (
            <div className="space-y-3 text-sm">
              {/* Read-only view of criteria */}
              {project.search_criteria.title_keywords && project.search_criteria.title_keywords.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Job Titles:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.search_criteria.title_keywords.map(title => (
                      <Badge key={title} variant="secondary" className="text-xs rounded-md">{title}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.search_criteria.keywords && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Keywords:</span>
                  <Badge variant="outline" className="text-xs rounded-md">{project.search_criteria.keywords}</Badge>
                </div>
              )}
              {project.search_criteria.locations && project.search_criteria.locations.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Locations:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.search_criteria.locations.map(loc => (
                      <Badge key={loc} variant="outline" className="text-xs rounded-md">
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.search_criteria.seniorities && project.search_criteria.seniorities.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Seniority:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.search_criteria.seniorities.map(level => (
                      <Badge key={level} variant="outline" className="text-xs rounded-md capitalize">{level.replace('_', ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.search_criteria.company_sizes && project.search_criteria.company_sizes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Company Size:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.search_criteria.company_sizes.map(size => (
                      <Badge key={size} variant="outline" className="text-xs rounded-md">{size}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {project.search_criteria.experience_years && (project.search_criteria.experience_years.min || project.search_criteria.experience_years.max) && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-virgilio-muted">Experience:</span>
                  <Badge variant="outline" className="text-xs rounded-md">
                    {project.search_criteria.experience_years.min || 0} - {project.search_criteria.experience_years.max || 30} years
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Result Filters Section */}
        <div className="space-y-4 p-4 rounded-xl bg-gradient-to-b from-virgilio-purple/5 to-transparent border border-virgilio-border/30 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-virgilio-text">Result Filters</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onFiltersChange({
                matchTiers: [],
                minExperience: 0,
                maxExperience: 30,
                source: 'all'
              })}
              className="h-8 px-3 text-xs rounded-lg transition-all duration-200 hover:bg-virgilio-purple/10 hover:text-virgilio-text hover:shadow-sm"
            >
              Reset
            </Button>
          </div>

          {/* Source Filter */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-virgilio-muted">Source</Label>
            <div className="space-y-2">
              {(['all', 'local', 'apollo'] as const).map(source => (
                <label key={source} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox 
                    checked={!filters.source || filters.source === source}
                    onCheckedChange={(checked) => {
                      onFiltersChange({
                        ...filters,
                        source: checked ? source : 'all'
                      })
                    }}
                    className="transition-all duration-200"
                  />
                  <span className="text-sm capitalize text-virgilio-text group-hover:text-virgilio-purple transition-colors">{source}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Match Tier */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-virgilio-muted">Match Tier</Label>
            <div className="space-y-2">
              {(['excellent', 'good', 'fair', 'minimal'] as const).map(tier => (
                <label key={tier} className="flex items-center gap-2.5 cursor-pointer group">
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
                    className="transition-all duration-200"
                  />
                  <span className="text-sm capitalize text-virgilio-text group-hover:text-virgilio-purple transition-colors">{tier}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Experience Range */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-virgilio-muted">Experience (years)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input 
                  type="number"
                  placeholder="Min"
                  value={filters.minExperience || 0}
                  onChange={(e) => onFiltersChange({ ...filters, minExperience: parseInt(e.target.value) || 0 })}
                  className="h-9 text-sm"
                  min={0}
                  max={30}
                />
              </div>
              <span className="text-xs text-virgilio-muted">to</span>
              <div className="flex-1">
                <Input 
                  type="number"
                  placeholder="Max"
                  value={filters.maxExperience || 30}
                  onChange={(e) => onFiltersChange({ ...filters, maxExperience: parseInt(e.target.value) || 30 })}
                  className="h-9 text-sm"
                  min={0}
                  max={50}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
