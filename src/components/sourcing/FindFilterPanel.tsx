import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronRight, Briefcase, Tag, MapPin, TrendingUp, Users, Factory, Building2, Clock, Mail, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import { LocationSelector } from './LocationSelector'
import { AutocompleteTagInput } from './AutocompleteTagInput'
import { SearchCriteria, SourcingProjectFilters } from '@/types/sourcing'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import type { LucideIcon } from 'lucide-react'

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
}

function CollapsibleSection({
  label,
  icon: Icon,
  defaultOpen = false,
  rightAdornment,
  children,
}: {
  label: string
  icon?: LucideIcon
  defaultOpen?: boolean
  rightAdornment?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex items-center justify-between w-full py-1.5">
        <CollapsibleTrigger className="flex items-center gap-1.5 flex-1 text-left hover:text-foreground transition-colors group">
          <span className="flex items-center gap-1.5 font-poppins font-semibold text-[13px] text-text-primary tracking-[-0.01em]">
            {Icon && <Icon className="h-3.5 w-3.5 text-text-tertiary" />}
            {label}
          </span>
        </CollapsibleTrigger>
        <div className="flex items-center gap-1.5">
          {rightAdornment}
          <CollapsibleTrigger className="text-text-tertiary hover:text-text-primary transition-colors">
            {open ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </CollapsibleTrigger>
        </div>
      </div>
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
}: {
  placeholder: string
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  badgeVariant?: 'secondary' | 'pastel-purple' | 'keyword-match' | 'pastel-orange'
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
        />
        <Button size="sm" variant="ghost" onClick={handleAdd} className="h-7 w-7 p-0 hover:bg-primary/10">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant={badgeVariant} className="text-[10px] h-5 gap-0.5 pr-1">
              {tag}
              <button onClick={() => onRemove(tag)} className="hover:bg-destructive/10 rounded-sm">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_CRITERIA: SearchCriteria = {
  skills: [],
  title_keywords: [],
  keywords: [],
  locations: [],
  seniorities: [],
  company_sizes: [],
  industries: [],
  company_names: [],
  experience_years: {},
}

export function FindFilterPanel({
  criteria,
  onCriteriaChange,
  resultFilters,
  onResultFiltersChange,
}: FindFilterPanelProps) {
  const c = criteria || EMPTY_CRITERIA

  const toggleArrayValue = (key: keyof SearchCriteria, value: string) => {
    const current = (c[key] as string[] | undefined) || []
    const updated = current.includes(value) 
      ? current.filter(v => v !== value) 
      : [...current, value]
    onCriteriaChange({ [key]: updated })
  }

  const { data: creditsUsage } = useSourcingCredits()
  const collectRemaining = creditsUsage
    ? Math.max(0, (creditsUsage.collect_credits_limit || 0) - (creditsUsage.collect_credits_used || 0)) + (creditsUsage.bonus_credits_available || 0)
    : null

  const SUGGESTED_KEYWORDS = ['Prototyping', 'User research', 'UI engineering', 'Accessibility']
  const visibleSuggestions = SUGGESTED_KEYWORDS.filter(s => !(c.keywords || []).map(k => k.toLowerCase()).includes(s.toLowerCase()))

  const handleSearch = () => {
    // Re-run search by touching criteria — the parent debounces and refetches.
    onCriteriaChange({ title_keywords: [...(c.title_keywords || [])] })
  }

  return (
    <Card className="w-[280px] shrink-0 flex flex-col min-h-0 overflow-hidden self-start max-h-full">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-poppins font-semibold text-[14px] text-text-primary tracking-[-0.01em]">Search criteria</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              onCriteriaChange({
                skills: [], title_keywords: [], keywords: [], locations: [],
                seniorities: [], company_sizes: [], industries: [], company_names: [],
                experience_years: {},
              })
              onResultFiltersChange({
                matchTiers: [], minExperience: 0, maxExperience: 30, source: 'all',
                hasEmail: undefined, hasPhone: undefined, candidateSource: undefined,
              })
            }}
            className="text-[11.5px] text-text-tertiary hover:text-text-primary"
          >
            Reset
          </Button>
        </div>
        <p className="text-[11.5px] text-text-tertiary mt-1">Start with a prompt — Gio will fill these in.</p>
      </div>


      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-3">
        <CollapsibleSection
          label="Job titles"
          defaultOpen={(c.title_keywords?.length ?? 0) > 0}
          rightAdornment={
            <Badge tone="lilac" size="xs" icon={Sparkles}>AI</Badge>
          }
        >
          <AutocompleteTagInput
            placeholder="e.g. Senior Product Designer"
            tags={c.title_keywords || []}
            onAdd={(tag) => onCriteriaChange({ title_keywords: [...(c.title_keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ title_keywords: (c.title_keywords || []).filter(t => t !== tag) })}
            badgeVariant="pastel-purple"
            table="standard_job_titles"
          />
        </CollapsibleSection>

        <CollapsibleSection label="Skills & keywords" icon={Tag} defaultOpen={(c.keywords?.length ?? 0) > 0 || visibleSuggestions.length > 0}>
          <AutocompleteTagInput
            placeholder="Add skills..."
            tags={c.keywords || []}
            onAdd={(tag) => onCriteriaChange({ keywords: [...(c.keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ keywords: (c.keywords || []).filter(t => t !== tag) })}
            badgeVariant="keyword-match"
            table="standard_skills"
          />
          {visibleSuggestions.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                Suggested by Gio
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onCriteriaChange({ keywords: [...(c.keywords || []), s] })}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-full bg-virgilio-lilac/40 hover:bg-virgilio-lilac/60 border border-virgilio-purple/15 text-virgilio-purple font-poppins font-medium text-[11.5px] tracking-[-0.005em] transition-colors"
                  >
                    <Plus className="h-3 w-3 opacity-65" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>


        <CollapsibleSection label="Locations" icon={MapPin} defaultOpen={(c.locations?.length ?? 0) > 0}>
          <LocationSelector
            selectedLocations={c.locations || []}
            onLocationsChange={(locations) => onCriteriaChange({ locations })}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Seniority" icon={TrendingUp} defaultOpen={(c.seniorities?.length ?? 0) > 0}>
          <FilterCheckboxGroup
            label="Seniority"
            options={SENIORITY_OPTIONS}
            selectedValues={c.seniorities || []}
            onToggle={(value) => toggleArrayValue('seniorities', value)}
            onClear={() => onCriteriaChange({ seniorities: [] })}
            maxVisible={6}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Company Size" icon={Users} defaultOpen={(c.company_sizes?.length ?? 0) > 0}>
          <FilterCheckboxGroup
            label="Company Size"
            options={COMPANY_SIZE_OPTIONS}
            selectedValues={c.company_sizes || []}
            onToggle={(value) => toggleArrayValue('company_sizes', value)}
            onClear={() => onCriteriaChange({ company_sizes: [] })}
            maxVisible={6}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Industry" icon={Factory} defaultOpen={(c.industries?.length ?? 0) > 0}>
          <FilterCheckboxGroup
            label="Industry"
            options={INDUSTRY_OPTIONS}
            selectedValues={c.industries || []}
            onToggle={(value) => toggleArrayValue('industries', value)}
            onClear={() => onCriteriaChange({ industries: [] })}
            searchable
            searchThreshold={6}
            maxVisible={6}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Target Companies" icon={Building2} defaultOpen={(c.company_names?.length ?? 0) > 0}>
          <TagInput
            placeholder="Add company..."
            tags={c.company_names || []}
            onAdd={(tag) => onCriteriaChange({ company_names: [...(c.company_names || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ company_names: (c.company_names || []).filter(t => t !== tag) })}
            badgeVariant="pastel-orange"
          />
        </CollapsibleSection>

        <CollapsibleSection label="Experience (years)" icon={Clock} defaultOpen={c.experience_years?.min != null || c.experience_years?.max != null}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={c.experience_years?.min ?? ''}
              onChange={(e) => onCriteriaChange({
                experience_years: {
                  ...c.experience_years,
                  min: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              min={0} max={30}
              className="h-7 text-xs w-16"
            />
            <span className="text-[10px] text-muted-foreground">to</span>
            <Input
              type="number"
              placeholder="Max"
              value={c.experience_years?.max ?? ''}
              onChange={(e) => onCriteriaChange({
                experience_years: {
                  ...c.experience_years,
                  max: e.target.value ? parseInt(e.target.value) : undefined
                }
              })}
              min={0} max={30}
              className="h-7 text-xs w-16"
            />
          </div>
        </CollapsibleSection>

        <Separator />

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
                hasPhone: undefined,
                candidateSource: undefined
              })}
              className="h-6 px-2 text-[10px] rounded-md hover:bg-primary/10"
            >
              Reset
            </Button>
          </div>

          <CollapsibleSection label="Contact Info" icon={Mail}>
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

          <CollapsibleSection label="Candidate Source" icon={Users}>
            <div className="space-y-1.5">
              {([
                { value: 'internal' as const, label: 'Internal' },
                { value: 'gio' as const, label: 'Gio' },
                { value: 'external' as const, label: 'External' },
              ]).map(opt => {
                const selected = resultFilters.candidateSource || []
                const checked = selected.includes(opt.value)
                return (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => {
                        const updated = checked
                          ? selected.filter(v => v !== opt.value)
                          : [...selected, opt.value]
                        onResultFiltersChange({ ...resultFilters, candidateSource: updated.length > 0 ? updated : undefined })
                      }}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-xs text-foreground group-hover:text-primary transition-colors">{opt.label}</span>
                  </label>
                )
              })}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div className="shrink-0 border-t border-border px-4 py-3 space-y-2 bg-white">
        <Button
          variant="purple"
          size="lg"
          icon={Sparkles}
          onClick={handleSearch}
          className="w-full justify-center"
          disabled={(c.title_keywords?.length ?? 0) === 0}
        >
          Find candidates
        </Button>
        <p className="text-[11px] text-text-tertiary text-center">
          Preview is free · Collect uses 1 credit each{collectRemaining != null && ` · ${collectRemaining} remaining`}
        </p>
      </div>
    </Card>
  )
}
