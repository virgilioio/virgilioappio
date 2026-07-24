import { useState, useEffect } from 'react'
import { Plus, X, ChevronDown, ChevronRight, RotateCcw, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { FilterCheckboxGroup } from '@/components/ui/filter-checkbox-group'
import { LocationSelector } from './LocationSelector'
import { AutocompleteTagInput } from './AutocompleteTagInput'
import { SearchCriteria, SourcingProjectFilters } from '@/types/sourcing'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'

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

function GroupSection({
  label,
  defaultOpen = false,
  count,
  rightAdornment,
  children,
}: {
  label: string
  defaultOpen?: boolean
  count?: number
  rightAdornment?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (defaultOpen) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultOpen])
  return (
    <div className="border-b border-[#F1F0EC] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-[14px] py-[10px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDE4FF] focus-visible:border-[#6F3FF5] rounded-none"
      >
        <span className="flex items-center gap-1.5">
          <span className="font-poppins font-semibold text-[12px] text-[#1F2230] tracking-[-0.005em]">{label}</span>
          {count != null && count > 0 && (
            <Badge tone="purple" size="xs">{count}</Badge>
          )}
        </span>
        <span className="flex items-center gap-1">
          {rightAdornment}
          {open ? (
            <ChevronDown className="h-3 w-3 text-[#8B8F9E]" />
          ) : (
            <ChevronRight className="h-3 w-3 text-[#8B8F9E]" />
          )}
        </span>
      </button>
      {open && (
        <div className="px-[14px] pb-3">
          {children}
        </div>
      )}
    </div>
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
          className="h-[34px] text-[12px] flex-1"
        />
        <Button size="sm" variant="ghost" onClick={handleAdd} className="h-[34px] w-8 p-0 hover:bg-primary/10">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <Badge key={tag} variant={badgeVariant} className="text-[11px] h-[22px] gap-0.5 pr-1">
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
    onCriteriaChange({ title_keywords: [...(c.title_keywords || [])] })
  }

  const handleReset = () => {
    onCriteriaChange({
      skills: [], title_keywords: [], keywords: [], locations: [],
      seniorities: [], company_sizes: [], industries: [], company_names: [],
      experience_years: {},
    })
    onResultFiltersChange({
      matchTiers: [], minExperience: 0, maxExperience: 30, source: 'all',
      hasEmail: undefined, hasPhone: undefined, candidateSource: undefined,
    })
  }

  const contactCount = (resultFilters.hasEmail ? 1 : 0) + (resultFilters.hasPhone ? 1 : 0)
  const sourceCount = (resultFilters.candidateSource?.length) ?? 0
  const expCount = (c.experience_years?.min != null || c.experience_years?.max != null) ? 1 : 0

  return (
    <aside
      className="w-[296px] shrink-0 flex flex-col self-start max-h-full bg-white overflow-hidden"
      style={{ border: '1px solid #E7E8EE', borderRadius: 14 }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F1F0EC' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span className="font-poppins font-semibold text-[13.5px] text-[#1F2230] tracking-[-0.005em]">
            Search criteria
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            icon={RotateCcw}
            className="text-[11.5px] text-[#5A6072] hover:text-[#1F2230] h-7 px-2"
          >
            Reset
          </Button>
        </div>
        <p className="font-inter text-[11px] text-[#8B8F9E]">
          Start with a prompt — Gio will fill these in.
        </p>
      </div>

      {/* Body — only scroller */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <GroupSection
          label="Job titles"
          count={c.title_keywords?.length ?? 0}
          defaultOpen={(c.title_keywords?.length ?? 0) > 0}
          rightAdornment={<Badge tone="purple" size="xs" icon={Sparkles}>AI</Badge>}
        >
          <AutocompleteTagInput
            placeholder="e.g. Senior Product Designer"
            tags={c.title_keywords || []}
            onAdd={(tag) => onCriteriaChange({ title_keywords: [...(c.title_keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ title_keywords: (c.title_keywords || []).filter(t => t !== tag) })}
            badgeVariant="pastel-purple"
            table="standard_job_titles"
          />
        </GroupSection>

        <GroupSection
          label="Skills & keywords"
          count={c.keywords?.length ?? 0}
          defaultOpen={(c.keywords?.length ?? 0) > 0 || visibleSuggestions.length > 0}
        >
          <AutocompleteTagInput
            placeholder="Add skills..."
            tags={c.keywords || []}
            onAdd={(tag) => onCriteriaChange({ keywords: [...(c.keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ keywords: (c.keywords || []).filter(t => t !== tag) })}
            badgeVariant="keyword-match"
            table="standard_skills"
          />
          {visibleSuggestions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p
                className="font-inter uppercase text-[#8B8F9E]"
                style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.06em', marginBottom: 6 }}
              >
                Suggested by Gio
              </p>
              <div className="flex flex-wrap" style={{ gap: 4 }}>
                {visibleSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onCriteriaChange({ keywords: [...(c.keywords || []), s] })}
                    className="inline-flex items-center gap-1 font-inter transition-colors hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EDE4FF]"
                    style={{
                      padding: '3px 8px',
                      background: '#FAF8FF',
                      color: '#5B21B6',
                      border: '1px dashed #D7C5FB',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 500,
                    }}
                  >
                    <Plus className="h-[9px] w-[9px]" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </GroupSection>

        <GroupSection
          label="Locations"
          count={c.locations?.length ?? 0}
          defaultOpen={(c.locations?.length ?? 0) > 0}
        >
          <LocationSelector
            selectedLocations={c.locations || []}
            onLocationsChange={(locations) => onCriteriaChange({ locations })}
          />
        </GroupSection>

        <GroupSection
          label="Seniority"
          count={c.seniorities?.length ?? 0}
          defaultOpen={(c.seniorities?.length ?? 0) > 0}
        >
          <FilterCheckboxGroup
            label="Seniority"
            options={SENIORITY_OPTIONS}
            selectedValues={c.seniorities || []}
            onToggle={(value) => toggleArrayValue('seniorities', value)}
            onClear={() => onCriteriaChange({ seniorities: [] })}
            maxVisible={6}
          />
        </GroupSection>

        <GroupSection
          label="Company Size"
          count={c.company_sizes?.length ?? 0}
          defaultOpen={(c.company_sizes?.length ?? 0) > 0}
        >
          <FilterCheckboxGroup
            label="Company Size"
            options={COMPANY_SIZE_OPTIONS}
            selectedValues={c.company_sizes || []}
            onToggle={(value) => toggleArrayValue('company_sizes', value)}
            onClear={() => onCriteriaChange({ company_sizes: [] })}
            maxVisible={6}
          />
        </GroupSection>

        <GroupSection
          label="Industry"
          count={c.industries?.length ?? 0}
          defaultOpen={(c.industries?.length ?? 0) > 0}
        >
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
        </GroupSection>

        <GroupSection
          label="Target Companies"
          count={c.company_names?.length ?? 0}
          defaultOpen={(c.company_names?.length ?? 0) > 0}
        >
          <TagInput
            placeholder="Add company..."
            tags={c.company_names || []}
            onAdd={(tag) => onCriteriaChange({ company_names: [...(c.company_names || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ company_names: (c.company_names || []).filter(t => t !== tag) })}
            badgeVariant="secondary"
          />
        </GroupSection>

        <GroupSection
          label="Experience (years)"
          count={expCount}
          defaultOpen={expCount > 0}
        >
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
              min={0}
              max={30}
              className="h-[34px] text-[12px] w-20"
            />
            <span className="font-inter text-[11px] text-[#5A6072]">to</span>
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
              min={0}
              max={30}
              className="h-[34px] text-[12px] w-20"
            />
          </div>
        </GroupSection>

        <GroupSection
          label="Contact Info"
          count={contactCount}
        >
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer py-[5px]">
              <Checkbox
                checked={resultFilters.hasEmail === true}
                onCheckedChange={(checked) => {
                  onResultFiltersChange({ ...resultFilters, hasEmail: checked ? true : undefined })
                }}
                className="h-[14px] w-[14px]"
              />
              <span className="font-inter text-[12px] text-[#1F2230]">Has Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-[5px]">
              <Checkbox
                checked={resultFilters.hasPhone === true}
                onCheckedChange={(checked) => {
                  onResultFiltersChange({ ...resultFilters, hasPhone: checked ? true : undefined })
                }}
                className="h-[14px] w-[14px]"
              />
              <span className="font-inter text-[12px] text-[#1F2230]">Has Phone</span>
            </label>
          </div>
        </GroupSection>

        <GroupSection
          label="Candidate Source"
          count={sourceCount}
        >
          <div className="space-y-1.5">
            {([
              { value: 'internal' as const, label: 'Internal' },
              { value: 'gio' as const, label: 'Gio' },
              { value: 'external' as const, label: 'External' },
            ]).map(opt => {
              const selected = resultFilters.candidateSource || []
              const checked = selected.includes(opt.value)
              return (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer py-[5px]">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => {
                      const updated = checked
                        ? selected.filter(v => v !== opt.value)
                        : [...selected, opt.value]
                      onResultFiltersChange({ ...resultFilters, candidateSource: updated.length > 0 ? updated : undefined })
                    }}
                    className="h-[14px] w-[14px]"
                  />
                  <span className="font-inter text-[12px] text-[#1F2230]">{opt.label}</span>
                </label>
              )
            })}
          </div>
        </GroupSection>
      </div>

      {/* Footer */}
      <div
        className="shrink-0 bg-white"
        style={{ padding: 12, borderTop: '1px solid #F1F0EC', display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <Button
          variant="purple"
          size="md"
          icon={Sparkles}
          onClick={handleSearch}
          className="w-full justify-center"
          disabled={(c.title_keywords?.length ?? 0) === 0}
        >
          Find candidates
        </Button>
        <p
          className="font-inter text-center text-[#8B8F9E]"
          style={{ fontSize: 10.5 }}
        >
          Preview is free · Collect uses 1 credit each{collectRemaining != null && ` · ${collectRemaining} remaining`}
        </p>
      </div>
    </aside>
  )
}
