import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SourcingProjectFilters, SourcingProject, SearchCriteria } from '@/types/sourcing'
import { LocationSelector } from '@/components/sourcing/LocationSelector'
import { X, Plus, Loader2, RefreshCw } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  const [newSkill, setNewSkill] = useState('')
  const [newTitleKeyword, setNewTitleKeyword] = useState('')

  const handleSaveAndRefresh = async () => {
    if (editableCriteria.skills.length === 0) return
    await onUpdateSearchCriteria(editableCriteria)
    setIsEditingCriteria(false)
  }

  const handleCancelEdit = () => {
    setEditableCriteria(project.search_criteria)
    setIsEditingCriteria(false)
  }

  const handleAddSkill = () => {
    if (newSkill.trim() && !editableCriteria.skills.includes(newSkill.trim())) {
      setEditableCriteria({
        ...editableCriteria,
        skills: [...editableCriteria.skills, newSkill.trim()]
      })
      setNewSkill('')
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setEditableCriteria({
      ...editableCriteria,
      skills: editableCriteria.skills.filter(s => s !== skill)
    })
  }

  const handleAddTitleKeyword = () => {
    if (newTitleKeyword.trim()) {
      const currentKeywords = editableCriteria.title_keywords || []
      if (!currentKeywords.includes(newTitleKeyword.trim())) {
        setEditableCriteria({
          ...editableCriteria,
          title_keywords: [...currentKeywords, newTitleKeyword.trim()]
        })
        setNewTitleKeyword('')
      }
    }
  }

  const handleRemoveTitleKeyword = (keyword: string) => {
    setEditableCriteria({
      ...editableCriteria,
      title_keywords: (editableCriteria.title_keywords || []).filter(k => k !== keyword)
    })
  }

  return (
    <div className="w-80 border-r border-border bg-surface-primary p-4 space-y-6 overflow-y-auto">
      {/* Search Criteria Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Search Criteria</h3>
          {!isEditingCriteria ? (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setEditableCriteria(project.search_criteria)
                setIsEditingCriteria(true)
              }}
              className="h-7 px-2 text-xs"
            >
              Edit
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-7 px-2 text-xs">
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveAndRefresh} 
                disabled={isRefreshing || editableCriteria.skills.length === 0}
                className="h-7 px-2 text-xs"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Save & Refresh
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {isEditingCriteria ? (
          <div className="space-y-4">
            {/* Skills */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Skills *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add skill..."
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSkill()
                    }
                  }}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" onClick={handleAddSkill} className="h-8 w-8 p-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editableCriteria.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs pr-1">
                    {skill}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:bg-muted-foreground/20 rounded-sm p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Job Titles */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Job Titles</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add title..."
                  value={newTitleKeyword}
                  onChange={(e) => setNewTitleKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddTitleKeyword()
                    }
                  }}
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" onClick={handleAddTitleKeyword} className="h-8 w-8 p-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              {editableCriteria.title_keywords && editableCriteria.title_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {editableCriteria.title_keywords.map(keyword => (
                    <Badge key={keyword} variant="outline" className="text-xs pr-1">
                      {keyword}
                      <button
                        onClick={() => handleRemoveTitleKeyword(keyword)}
                        className="ml-1 hover:bg-muted-foreground/20 rounded-sm p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Search Locations</Label>
              <LocationSelector
                selectedLocations={editableCriteria.locations || []}
                onLocationsChange={(locations) => setEditableCriteria({ ...editableCriteria, locations })}
              />
            </div>

            {/* Salary Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Salary Range</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={editableCriteria.salary_min || ''}
                  onChange={(e) => setEditableCriteria({ 
                    ...editableCriteria, 
                    salary_min: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={editableCriteria.salary_max || ''}
                  onChange={(e) => setEditableCriteria({ 
                    ...editableCriteria, 
                    salary_max: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  className="h-8 text-sm flex-1"
                />
              </div>
              <Select
                value={editableCriteria.currency || 'USD'}
                onValueChange={(value) => setEditableCriteria({ ...editableCriteria, currency: value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="MXN">MXN</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CAD">CAD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Experience Range */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Experience Years</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={editableCriteria.experience_years?.min || ''}
                  onChange={(e) => setEditableCriteria({
                    ...editableCriteria,
                    experience_years: {
                      ...editableCriteria.experience_years,
                      min: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="h-8 text-sm w-20"
                  min={0}
                  max={30}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={editableCriteria.experience_years?.max || ''}
                  onChange={(e) => setEditableCriteria({
                    ...editableCriteria,
                    experience_years: {
                      ...editableCriteria.experience_years,
                      max: e.target.value ? parseInt(e.target.value) : undefined
                    }
                  })}
                  className="h-8 text-sm w-20"
                  min={0}
                  max={30}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            {/* Read-only view of criteria */}
            {project.search_criteria.skills.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Skills:</span>
                <div className="flex flex-wrap gap-1">
                  {project.search_criteria.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
            {project.search_criteria.title_keywords && project.search_criteria.title_keywords.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Titles:</span>
                <div className="flex flex-wrap gap-1">
                  {project.search_criteria.title_keywords.map(title => (
                    <Badge key={title} variant="outline" className="text-xs">{title}</Badge>
                  ))}
                </div>
              </div>
            )}
            {project.search_criteria.locations && project.search_criteria.locations.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Locations:</span>
                <div className="flex flex-wrap gap-1">
                  {project.search_criteria.locations.map(loc => {
                    // Parse location value to display format
                    const parts = loc.split(',')
                    let label = loc
                    if (parts.length === 3) {
                      label = `${parts[0]}, ${parts[1]}, ${parts[2]}` // City, State, Country
                    } else if (parts.length === 2) {
                      label = `${parts[0]}, ${parts[1]}` // State, Country
                    } else {
                      label = parts[0] // Just country code
                    }
                    return (
                      <Badge key={loc} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Result Filters Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Result Filters</h3>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onFiltersChange({
              matchTiers: [],
              minExperience: 0,
              maxExperience: 30,
              source: 'all'
            })}
            className="h-7 px-2 text-xs"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Source Filter */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Source</Label>
        <div className="space-y-2">
          {(['all', 'local', 'coresignal'] as const).map(source => (
            <label key={source} className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={!filters.source || filters.source === source}
                onCheckedChange={(checked) => {
                  onFiltersChange({
                    ...filters,
                    source: checked ? source : 'all'
                  })
                }}
              />
              <span className="text-sm capitalize">{source}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Match Tier */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Match Tier</Label>
        <div className="space-y-2">
          {(['excellent', 'good', 'fair', 'minimal'] as const).map(tier => (
            <label key={tier} className="flex items-center gap-2 cursor-pointer">
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
              <span className="text-sm capitalize">{tier}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Experience Range */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">Experience (years)</Label>
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
          <span className="text-xs text-muted-foreground">to</span>
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
  )
}
