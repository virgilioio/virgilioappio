import { useState } from 'react'
import { Plus, X, Info } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchCriteria } from '@/types/sourcing'
import { LocationSelector } from '@/components/sourcing/LocationSelector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EditableSearchCriteriaProps {
  criteria: SearchCriteria
  onChange: (criteria: SearchCriteria) => void
}

// Apollo seniority options
const SENIORITY_OPTIONS = [
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'head', label: 'Head' },
  { value: 'vp', label: 'VP' },
  { value: 'c_suite', label: 'C-Suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
]

// Apollo company size options
const COMPANY_SIZE_OPTIONS = [
  { value: '1,10', label: '1-10 employees' },
  { value: '11,50', label: '11-50 employees' },
  { value: '51,200', label: '51-200 employees' },
  { value: '201,500', label: '201-500 employees' },
  { value: '501,1000', label: '501-1,000 employees' },
  { value: '1001,5000', label: '1,001-5,000 employees' },
  { value: '5001,10000', label: '5,001-10,000 employees' },
  { value: '10001,', label: '10,000+ employees' },
]

export function EditableSearchCriteria({
  criteria,
  onChange
}: EditableSearchCriteriaProps) {
  const [newTitleKeyword, setNewTitleKeyword] = useState('')
  const [newKeyword, setNewKeyword] = useState('')

  const handleAddTitleKeyword = () => {
    if (newTitleKeyword.trim()) {
      const currentKeywords = criteria.title_keywords || []
      if (!currentKeywords.includes(newTitleKeyword.trim())) {
        onChange({
          ...criteria,
          title_keywords: [...currentKeywords, newTitleKeyword.trim()]
        })
        setNewTitleKeyword('')
      }
    }
  }

  const handleRemoveTitleKeyword = (keyword: string) => {
    onChange({
      ...criteria,
      title_keywords: (criteria.title_keywords || []).filter(k => k !== keyword)
    })
  }

  const handleLocationsChange = (locations: string[]) => {
    onChange({
      ...criteria,
      locations
    })
  }

  const handleAddSeniority = (value: string) => {
    if (value && !(criteria.seniorities || []).includes(value)) {
      onChange({
        ...criteria,
        seniorities: [...(criteria.seniorities || []), value]
      })
    }
  }

  const handleRemoveSeniority = (seniority: string) => {
    onChange({
      ...criteria,
      seniorities: (criteria.seniorities || []).filter(s => s !== seniority)
    })
  }

  const handleAddCompanySize = (value: string) => {
    if (value && !(criteria.company_sizes || []).includes(value)) {
      onChange({
        ...criteria,
        company_sizes: [...(criteria.company_sizes || []), value]
      })
    }
  }

  const handleRemoveCompanySize = (size: string) => {
    onChange({
      ...criteria,
      company_sizes: (criteria.company_sizes || []).filter(s => s !== size)
    })
  }

  const getSeniorityLabel = (value: string) => {
    return SENIORITY_OPTIONS.find(o => o.value === value)?.label || value
  }

  const getCompanySizeLabel = (value: string) => {
    return COMPANY_SIZE_OPTIONS.find(o => o.value === value)?.label || value
  }

  return (
    <div className="space-y-4">
      {/* Job Title Keywords - Primary filter for Apollo */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Job Title Keywords</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">Apollo searches by current job titles. Add variations like "Software Engineer", "Developer", "SWE" for broader results.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground">Primary search filter - matches candidates by their current job title</p>
        <div className="flex gap-2">
          <Input
            placeholder='e.g., "Senior Engineer", "Product Manager"'
            value={newTitleKeyword}
            onChange={(e) => setNewTitleKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTitleKeyword()
              }
            }}
            className="flex-1"
          />
          <Button size="sm" variant="virgilio" onClick={handleAddTitleKeyword}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {criteria.title_keywords && criteria.title_keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {criteria.title_keywords.map(keyword => (
              <Badge key={keyword} variant="secondary" className="gap-1">
                {keyword}
                <button
                  onClick={() => handleRemoveTitleKeyword(keyword)}
                  className="ml-1 hover:bg-destructive/10 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* General Keywords */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Keywords (Optional)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p className="text-xs">General keyword search across the entire profile including bio, experience, and skills.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder='e.g., "React", "TypeScript", "AWS"'
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (newKeyword.trim()) {
                  const currentKeywords = criteria.keywords || []
                  if (!currentKeywords.includes(newKeyword.trim())) {
                    onChange({
                      ...criteria,
                      keywords: [...currentKeywords, newKeyword.trim()]
                    })
                    setNewKeyword('')
                  }
                }
              }
            }}
            className="flex-1"
          />
          <Button 
            size="sm" 
            variant="virgilio" 
            onClick={() => {
              if (newKeyword.trim()) {
                const currentKeywords = criteria.keywords || []
                if (!currentKeywords.includes(newKeyword.trim())) {
                  onChange({
                    ...criteria,
                    keywords: [...currentKeywords, newKeyword.trim()]
                  })
                  setNewKeyword('')
                }
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {criteria.keywords && criteria.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {criteria.keywords.map(keyword => (
              <Badge key={keyword} variant="secondary" className="gap-1">
                {keyword}
                <button
                  onClick={() => onChange({
                    ...criteria,
                    keywords: (criteria.keywords || []).filter(k => k !== keyword)
                  })}
                  className="ml-1 hover:bg-destructive/10 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Locations - Using LocationSelector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Locations</Label>
        <p className="text-xs text-muted-foreground">Select locations from the dropdown to ensure accurate search results</p>
        <LocationSelector
          selectedLocations={criteria.locations || []}
          onLocationsChange={handleLocationsChange}
        />
      </div>

      {/* Seniority Level */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Seniority Level (Optional)</Label>
        <Select onValueChange={handleAddSeniority} value="">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add seniority level..." />
          </SelectTrigger>
          <SelectContent>
            {SENIORITY_OPTIONS.filter(opt => !(criteria.seniorities || []).includes(opt.value)).map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {criteria.seniorities && criteria.seniorities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {criteria.seniorities.map(seniority => (
              <Badge key={seniority} variant="outline" className="gap-1">
                {getSeniorityLabel(seniority)}
                <button
                  onClick={() => handleRemoveSeniority(seniority)}
                  className="ml-1 hover:bg-destructive/10 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Company Size */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Company Size (Optional)</Label>
        <Select onValueChange={handleAddCompanySize} value="">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Add company size filter..." />
          </SelectTrigger>
          <SelectContent>
            {COMPANY_SIZE_OPTIONS.filter(opt => !(criteria.company_sizes || []).includes(opt.value)).map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {criteria.company_sizes && criteria.company_sizes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {criteria.company_sizes.map(size => (
              <Badge key={size} variant="outline" className="gap-1">
                {getCompanySizeLabel(size)}
                <button
                  onClick={() => handleRemoveCompanySize(size)}
                  className="ml-1 hover:bg-destructive/10 rounded-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Experience Range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Experience Years (Optional)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={criteria.experience_years?.min || ''}
            onChange={(e) => onChange({
              ...criteria,
              experience_years: {
                ...criteria.experience_years,
                min: e.target.value ? parseInt(e.target.value) : undefined
              }
            })}
            min={0}
            max={30}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="number"
            placeholder="Max"
            value={criteria.experience_years?.max || ''}
            onChange={(e) => onChange({
              ...criteria,
              experience_years: {
                ...criteria.experience_years,
                max: e.target.value ? parseInt(e.target.value) : undefined
              }
            })}
            min={0}
            max={30}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">years</span>
        </div>
      </div>
    </div>
  )
}
