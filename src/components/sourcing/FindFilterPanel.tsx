import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Search as SearchIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import { LocationSelector } from './LocationSelector'
import { SearchCriteria, SourcingProjectFilters } from '@/types/sourcing'

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

const COMPANY_SIZE_OPTIONS = [
  { value: '1,10', label: '1-10' },
  { value: '11,50', label: '11-50' },
  { value: '51,200', label: '51-200' },
  { value: '201,500', label: '201-500' },
  { value: '501,1000', label: '501-1K' },
  { value: '1001,5000', label: '1K-5K' },
  { value: '5001,10000', label: '5K-10K' },
  { value: '10001,', label: '10K+' },
]

const INDUSTRY_OPTIONS = [
  { value: 'information technology & services', label: 'IT & Services' },
  { value: 'computer software', label: 'Software' },
  { value: 'internet', label: 'Internet' },
  { value: 'financial services', label: 'Financial Services' },
  { value: 'banking', label: 'Banking' },
  { value: 'marketing and advertising', label: 'Marketing & Ads' },
  { value: 'management consulting', label: 'Consulting' },
  { value: 'hospital & health care', label: 'Healthcare' },
  { value: 'pharmaceuticals', label: 'Pharma' },
  { value: 'real estate', label: 'Real Estate' },
  { value: 'retail', label: 'Retail' },
  { value: 'e-commerce', label: 'E-commerce' },
  { value: 'education management', label: 'Education' },
  { value: 'telecommunications', label: 'Telecom' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'food & beverages', label: 'Food & Bev' },
  { value: 'construction', label: 'Construction' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'staffing and recruiting', label: 'Staffing' },
  { value: 'logistics and supply chain', label: 'Logistics' },
  { value: 'nonprofit organization management', label: 'Non-Profit' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'legal services', label: 'Legal' },
  { value: 'oil & energy', label: 'Oil & Energy' },
  { value: 'consumer goods', label: 'Consumer Goods' },
  { value: 'media', label: 'Media' },
]

interface FindFilterPanelProps {
  criteria: SearchCriteria | null
  onCriteriaChange: (updates: Partial<SearchCriteria>) => void
  resultFilters: SourcingProjectFilters
  onResultFiltersChange: (filters: SourcingProjectFilters) => void
  disabled?: boolean
}

function CollapsibleSection({ 
  label, 
  defaultOpen = true, 
  children 
}: { 
  label: string
  defaultOpen?: boolean
  children: React.ReactNode 
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-1.5 hover:text-foreground transition-colors group">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
          {label}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

function TagInput({ 
  placeholder, 
  tags, 
  onAdd, 
  onRemove, 
  badgeVariant = 'secondary',
  disabled 
}: {
  placeholder: string
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  badgeVariant?: 'secondary' | 'pastel-purple' | 'keyword-match' | 'pastel-orange'
  disabled?: boolean
}) {
  const [value, setValue] = useState('')
  const handleAdd = () => {
    if (!value.trim()) return
    if (!tags.includes(value.trim())) {
      onAdd(value.trim())
    }
    setValue('')
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          className="h-7 text-xs flex-1"
          disabled={disabled}
        />
        <Button size="sm" variant="ghost" onClick={handleAdd} className="h-7 w-7 p-0 hover:bg-primary/10" disabled={disabled}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant={badgeVariant} className="text-[10px] h-5 gap-0.5 pr-1">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:bg-destructive/10 rounded-sm" disabled={disabled}>
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function FindFilterPanel({
  criteria,
  onCriteriaChange,
  resultFilters,
  onResultFiltersChange,
  disabled = false
}: FindFilterPanelProps) {
  if (!criteria) {
    return (
      <div className="w-72 shrink-0 border-r border-border bg-background overflow-y-auto h-full">
        <div className="p-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Criteria</span>
          <p className="text-xs text-muted-foreground mt-4">
            Select or create a search to configure filters.
          </p>
        </div>
      </div>
    )
  }

  const toggleArrayValue = (key: keyof SearchCriteria, value: string) => {
    const current = (criteria[key] as string[] | undefined) || []
    const updated = current.includes(value) 
      ? current.filter(v => v !== value) 
      : [...current, value]
    onCriteriaChange({ [key]: updated })
  }

  return (
    <div className="w-72 shrink-0 border-r border-border bg-background overflow-y-auto h-full">
      <div className="p-4 space-y-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Criteria</span>

        {/* Job Titles */}
        <CollapsibleSection label="Job Titles">
          <TagInput
            placeholder="Add title..."
            tags={criteria.title_keywords || []}
            onAdd={(tag) => onCriteriaChange({ title_keywords: [...(criteria.title_keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ title_keywords: (criteria.title_keywords || []).filter(t => t !== tag) })}
            badgeVariant="pastel-purple"
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Keywords */}
        <CollapsibleSection label="Keywords">
          <TagInput
            placeholder="Add keyword..."
            tags={criteria.keywords || []}
            onAdd={(tag) => onCriteriaChange({ keywords: [...(criteria.keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ keywords: (criteria.keywords || []).filter(t => t !== tag) })}
            badgeVariant="keyword-match"
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Locations */}
        <CollapsibleSection label="Locations">
          <LocationSelector
            selectedLocations={criteria.locations || []}
            onLocationsChange={(locations) => onCriteriaChange({ locations })}
          />
        </CollapsibleSection>

        {/* Seniority */}
        <CollapsibleSection label="Seniority">
          <FilterCheckboxGroup
            label="Seniority"
            options={SENIORITY_OPTIONS}
            selectedValues={criteria.seniorities || []}
            onToggle={(value) => toggleArrayValue('seniorities', value)}
            onClear={() => onCriteriaChange({ seniorities: [] })}
            maxVisible={6}
          />
        </CollapsibleSection>

        {/* Company Size */}
        <CollapsibleSection label="Company Size">
          <FilterCheckboxGroup
            label="Company Size"
            options={COMPANY_SIZE_OPTIONS}
            selectedValues={criteria.company_sizes || []}
            onToggle={(value) => toggleArrayValue('company_sizes', value)}
            onClear={() => onCriteriaChange({ company_sizes: [] })}
            maxVisible={6}
          />
        </CollapsibleSection>

        {/* Industry */}
        <CollapsibleSection label="Industry">
          <FilterCheckboxGroup
            label="Industry"
            options={INDUSTRY_OPTIONS}
            selectedValues={criteria.industries || []}
            onToggle={(value) => toggleArrayValue('industries', value)}
            onClear={() => onCriteriaChange({ industries: [] })}
            searchable
            searchThreshold={6}
            maxVisible={6}
          />
        </CollapsibleSection>

        {/* Target Companies */}
        <CollapsibleSection label="Target Companies">
          <TagInput
            placeholder="Add company..."
            tags={criteria.company_names || []}
            onAdd={(tag) => onCriteriaChange({ company_names: [...(criteria.company_names || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ company_names: (criteria.company_names || []).filter(t => t !== tag) })}
            badgeVariant="pastel-orange"
            disabled={disabled}
          />
        </CollapsibleSection>

        {/* Experience */}
        <CollapsibleSection label="Experience (years)">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={criteria.experience_years?.min ?? ''}
              onChange={(e) => onCriteriaChange({
                experience_years: {
                  ...criteria.experience_years,
                  min: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              min={0} max={30}
              className="h-7 text-xs w-16"
              disabled={disabled}
            />
            <span className="text-[10px] text-muted-foreground">to</span>
            <Input
              type="number"
              placeholder="Max"
              value={criteria.experience_years?.max ?? ''}
              onChange={(e) => onCriteriaChange({
                experience_years: {
                  ...criteria.experience_years,
                  max: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              min={0} max={30}
              className="h-7 text-xs w-16"
              disabled={disabled}
            />
          </div>
        </CollapsibleSection>

        <Separator />

        {/* Result Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Result Filters</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResultFiltersChange({
                matchTiers: [],
                minExperience: 0,
                maxExperience: 30,
                source: 'all',
                hasEmail: undefined,
                hasPhone: undefined
              })}
              className="h-6 px-2 text-[10px] rounded-md hover:bg-primary/10"
            >
              Reset
            </Button>
          </div>

          <CollapsibleSection label="Contact Info" defaultOpen={true}>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={resultFilters.hasEmail === true}
                  onCheckedChange={(checked) => {
                    onResultFiltersChange({ ...resultFilters, hasEmail: checked ? true : undefined })
                  }}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-foreground group-hover:text-primary transition-colors">Has Email</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={resultFilters.hasPhone === true}
                  onCheckedChange={(checked) => {
                    onResultFiltersChange({ ...resultFilters, hasPhone: checked ? true : undefined })
                  }}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-foreground group-hover:text-primary transition-colors">Has Phone</span>
              </label>
            </div>
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
