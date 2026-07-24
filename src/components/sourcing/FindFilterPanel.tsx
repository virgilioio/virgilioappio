import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, X, ChevronDown, ChevronRight, RotateCcw, Sparkles, Check, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchCriteria, SourcingProjectFilters } from '@/types/sourcing'
import { useSourcingCredits } from '@/hooks/useSourcingCredits'
import { useAutocompleteSearch } from '@/hooks/useAutocompleteSearch'
import { LOCATION_OPTIONS } from '@/constants/locations'
import { cn } from '@/lib/utils'

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

/* ---------- Group section ---------- */
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
    <div style={{ borderBottom: '1px solid #F1F0EC' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-left focus:outline-none"
        style={{ padding: '10px 14px' }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="font-poppins"
            style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', color: '#1F2230' }}
          >
            {label}
          </span>
          {count != null && count > 0 && (
            <span
              className="font-inter inline-flex items-center"
              style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px',
                borderRadius: 999, background: '#EDE4FF', color: '#5B21B6',
                lineHeight: 1.4,
              }}
            >
              {count}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {rightAdornment}
          {open ? (
            <ChevronDown className="h-3 w-3" style={{ color: '#8B8F9E' }} />
          ) : (
            <ChevronRight className="h-3 w-3" style={{ color: '#8B8F9E' }} />
          )}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ---------- Token field (chips inside a bordered box) ---------- */
type TokenTone = 'purple' | 'blue' | 'green' | 'orange' | 'neutral'
const TONE_MAP: Record<TokenTone, { bg: string; fg: string }> = {
  purple: { bg: '#EDE4FF', fg: '#5B21B6' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  green: { bg: '#D1FAE5', fg: '#065F46' },
  orange: { bg: '#FED7AA', fg: '#9A3412' },
  neutral: { bg: '#F1F0EC', fg: '#5A6072' },
}

function TokenField({
  placeholder,
  tags,
  onAdd,
  onRemove,
  tone,
  autocompleteTable,
}: {
  placeholder: string
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  tone: TokenTone
  autocompleteTable?: 'standard_job_titles' | 'standard_skills'
}) {
  const [value, setValue] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const t = TONE_MAP[tone]

  const { suggestions, isLoading } = useAutocompleteSearch(
    autocompleteTable ?? 'standard_skills',
    autocompleteTable ? value : '',
    tags,
  )

  useEffect(() => {
    setHighlight(-1)
    setShowDropdown(!!autocompleteTable && value.trim().length >= 2)
  }, [value, autocompleteTable])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const commit = (raw: string) => {
    const v = raw.trim().replace(/,+$/, '').trim()
    if (v && !tags.includes(v)) onAdd(v)
    setValue('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (autocompleteTable && showDropdown && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); setHighlight(i => Math.min(i + 1, suggestions.length - 1)); return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault(); setHighlight(i => Math.max(i - 1, -1)); return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (autocompleteTable && highlight >= 0 && suggestions[highlight]) {
        commit(suggestions[highlight].canonical)
      } else if (value.trim()) {
        commit(value)
      }
    } else if (e.key === ',') {
      e.preventDefault()
      if (value.trim()) commit(value)
    } else if (e.key === 'Backspace' && !value && tags.length > 0) {
      onRemove(tags[tags.length - 1])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center"
        style={{
          gap: 4,
          minHeight: 34,
          padding: '5px 8px',
          background: '#fff',
          border: '1px solid #E0DDD3',
          borderRadius: 8,
          cursor: 'text',
        }}
      >
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center font-inter"
            style={{
              gap: 4, padding: '2px 8px', borderRadius: 999,
              background: t.bg, color: t.fg,
              fontSize: 11, fontWeight: 500, lineHeight: 1.4,
            }}
          >
            <span className="truncate max-w-[160px]">{tag}</span>
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={(e) => { e.stopPropagation(); onRemove(tag) }}
              className="inline-flex items-center justify-center"
              style={{ opacity: 0.55 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
            >
              <X style={{ width: 9, height: 9 }} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => { if (autocompleteTable && value.trim().length >= 2) setShowDropdown(true) }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 font-inter bg-transparent border-none outline-none"
          style={{
            minWidth: 80, padding: 4, fontSize: 12, color: '#1F2230',
          }}
        />
      </div>

      {autocompleteTable && showDropdown && (suggestions.length > 0 || isLoading) && (
        <div
          className="absolute z-50 left-0 right-0 mt-1"
          style={{
            top: '100%',
            background: '#fff',
            border: '1px solid #E7E8EE',
            borderRadius: 10,
            boxShadow: '0 12px 32px -12px rgba(13,13,9,0.18)',
            maxHeight: 220,
            overflow: 'auto',
          }}
        >
          {isLoading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#8B8F9E' }} />
            </div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={s.canonical}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); commit(s.canonical) }}
                onMouseEnter={() => setHighlight(i)}
                className="w-full text-left flex items-center justify-between"
                style={{
                  padding: '6px 10px',
                  background: i === highlight ? '#FAF8FF' : 'transparent',
                }}
              >
                <span className="font-inter truncate" style={{ fontSize: 12, color: '#1F2230' }}>
                  {s.canonical}
                </span>
                {s.category && (
                  <span className="font-inter shrink-0 ml-2" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
                    {s.category}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Check row (square checkbox) ---------- */
function CheckRow({
  label,
  checked,
  onToggle,
  count,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  count?: number
}) {
  return (
    <label
      className="flex items-center cursor-pointer"
      style={{ gap: 8, padding: '5px 0' }}
      onClick={(e) => { e.preventDefault(); onToggle() }}
    >
      <span
        className="inline-flex items-center justify-center shrink-0"
        style={{
          width: 14, height: 14, borderRadius: 4,
          background: checked ? '#6F3FF5' : '#fff',
          border: checked ? 'none' : '1.5px solid #C2C6D2',
        }}
      >
        {checked && <Check style={{ width: 9, height: 9, color: '#fff' }} strokeWidth={3} />}
      </span>
      <span className="font-inter" style={{ fontSize: 12, color: '#1F2230' }}>{label}</span>
      {count != null && count > 0 && (
        <span className="font-inter ml-auto" style={{ fontSize: 10.5, color: '#8B8F9E' }}>{count}</span>
      )}
    </label>
  )
}

/* ---------- Checkbox group (local, styled like §5/§6) ---------- */
function CheckboxGroup({
  options,
  selected,
  onToggle,
  searchable,
  searchThreshold = 8,
  maxVisible = 6,
}: {
  options: { value: string; label: string; count?: number }[]
  selected: string[]
  onToggle: (v: string) => void
  searchable?: boolean
  searchThreshold?: number
  maxVisible?: number
}) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const showSearch = searchable && options.length > searchThreshold
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options
  const visible = showAll ? filtered : filtered.slice(0, maxVisible)
  const hiddenCount = filtered.length - maxVisible

  return (
    <div>
      {showSearch && (
        <div className="relative" style={{ marginBottom: 6 }}>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ width: 11, height: 11, color: '#8B8F9E' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full font-inter outline-none"
            style={{
              height: 34, paddingLeft: 26, paddingRight: 8,
              border: '1px solid #E0DDD3', borderRadius: 8,
              fontSize: 12, color: '#1F2230', background: '#fff',
            }}
          />
        </div>
      )}
      <div>
        {visible.map(opt => (
          <CheckRow
            key={opt.value}
            label={opt.label}
            count={opt.count}
            checked={selected.includes(opt.value)}
            onToggle={() => onToggle(opt.value)}
          />
        ))}
        {!showAll && hiddenCount > 0 && !search && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="font-inter"
            style={{ fontSize: 11, color: '#5B21B6', paddingTop: 4 }}
          >
            Show {hiddenCount} more
          </button>
        )}
        {showAll && filtered.length > maxVisible && !search && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="font-inter"
            style={{ fontSize: 11, color: '#5B21B6', paddingTop: 4 }}
          >
            Show less
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Dual-thumb slider (Experience) ---------- */
function DualRange({
  min = 0, max = 30,
  minValue, maxValue,
  onChange,
}: {
  min?: number; max?: number
  minValue: number | undefined
  maxValue: number | undefined
  onChange: (v: { min?: number; max?: number }) => void
}) {
  const lo = minValue ?? min
  const hi = maxValue ?? max
  const pctLo = ((lo - min) / (max - min)) * 100
  const pctHi = ((hi - min) / (max - min)) * 100

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span className="font-inter" style={{ fontSize: 11, color: '#5A6072' }}>Years</span>
        <span className="font-inter" style={{ fontSize: 11, fontWeight: 500, color: '#1F2230' }}>
          {lo}y – {hi}y
        </span>
      </div>
      <div className="relative" style={{ height: 20 }}>
        {/* Track */}
        <div
          className="absolute left-0 right-0"
          style={{ top: '50%', transform: 'translateY(-50%)', height: 4, background: '#F1F0EC', borderRadius: 999 }}
        />
        {/* Fill */}
        <div
          className="absolute"
          style={{
            top: '50%', transform: 'translateY(-50%)',
            left: `${pctLo}%`, width: `${Math.max(0, pctHi - pctLo)}%`,
            height: 4, background: '#6F3FF5', borderRadius: 999,
          }}
        />
        {/* Min input */}
        <input
          type="range"
          min={min}
          max={max}
          value={lo}
          onChange={e => {
            const v = Math.min(parseInt(e.target.value), hi)
            onChange({ min: v === min ? undefined : v, max: maxValue })
          }}
          className="dual-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 3 }}
        />
        {/* Max input */}
        <input
          type="range"
          min={min}
          max={max}
          value={hi}
          onChange={e => {
            const v = Math.max(parseInt(e.target.value), lo)
            onChange({ min: minValue, max: v === max ? undefined : v })
          }}
          className="dual-range absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
          style={{ zIndex: 4 }}
        />
      </div>
      <style>{`
        .dual-range::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #6F3FF5;
          box-shadow: 0 1px 3px rgba(13,13,9,.18);
          cursor: pointer;
        }
        .dual-range::-moz-range-thumb {
          pointer-events: auto;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: #fff;
          border: 2px solid #6F3FF5;
          box-shadow: 0 1px 3px rgba(13,13,9,.18);
          cursor: pointer;
        }
        .dual-range::-webkit-slider-runnable-track { background: transparent; }
        .dual-range::-moz-range-track { background: transparent; }
        .dual-range:focus { outline: none; }
      `}</style>
    </div>
  )
}

/* ---------- Location field with 296px popover ---------- */
function LocationField({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const labelOf = (v: string) => LOCATION_OPTIONS.find(l => l.value === v)?.label ?? v

  const results = useMemo(() => LOCATION_OPTIONS
    .filter(l => !selected.includes(l.value))
    .filter(l => query === '' || l.label.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50), [selected, query])

  const typeLabel = (t: string) => t === 'city' ? 'City' : t === 'state' ? 'State' : 'Country'

  const pick = (val: string) => {
    onChange([...selected, val])
    setQuery('')
    inputRef.current?.focus()
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
        className="flex flex-wrap items-center"
        style={{
          gap: 4, minHeight: 34, padding: '5px 8px',
          background: '#fff', border: '1px solid #E0DDD3', borderRadius: 8, cursor: 'text',
        }}
      >
        {selected.map(v => {
          const t = TONE_MAP.green
          return (
            <span
              key={v}
              className="inline-flex items-center font-inter"
              style={{
                gap: 4, padding: '2px 8px', borderRadius: 999,
                background: t.bg, color: t.fg,
                fontSize: 11, fontWeight: 500, lineHeight: 1.4,
              }}
            >
              <span className="truncate max-w-[160px]">{labelOf(v)}</span>
              <button
                type="button"
                aria-label={`Remove ${labelOf(v)}`}
                onClick={(e) => { e.stopPropagation(); onChange(selected.filter(x => x !== v)) }}
                style={{ opacity: 0.55 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.55')}
              >
                <X style={{ width: 9, height: 9 }} />
              </button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, results.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)) }
            else if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); pick(results[highlight].value) }
            else if (e.key === 'Escape') { setOpen(false) }
            else if (e.key === 'Backspace' && !query && selected.length > 0) {
              onChange(selected.slice(0, -1))
            }
          }}
          placeholder={selected.length === 0 ? 'Add location…' : ''}
          className="flex-1 font-inter bg-transparent border-none outline-none"
          style={{ minWidth: 80, padding: 4, fontSize: 12, color: '#1F2230' }}
        />
      </div>

      {open && (
        <div
          className="absolute z-50 left-0 mt-1"
          style={{
            top: '100%',
            width: '100%',
            background: '#fff',
            border: '1px solid #E7E8EE',
            borderRadius: 10,
            boxShadow: '0 12px 32px -12px rgba(13,13,9,0.18)',
            maxHeight: 260,
            overflow: 'auto',
          }}
        >
          {results.length === 0 ? (
            <div className="font-inter" style={{ padding: '10px 12px', fontSize: 12, color: '#8B8F9E' }}>
              No locations found
            </div>
          ) : (
            results.map((l, i) => (
              <button
                key={l.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(l.value) }}
                onMouseEnter={() => setHighlight(i)}
                className="w-full text-left flex items-center justify-between"
                style={{
                  padding: '6px 10px',
                  background: i === highlight ? '#FAF8FF' : 'transparent',
                }}
              >
                <span className="font-inter truncate" style={{ fontSize: 12, color: '#1F2230' }}>{l.label}</span>
                <span className="font-inter shrink-0 ml-2" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
                  {typeLabel(l.type)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ---------- Main panel ---------- */
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
      className="flex flex-col self-stretch bg-white overflow-hidden"
      style={{
        width: 296, flexShrink: 0,
        border: '1px solid #E7E8EE', borderRadius: 14,
        height: '100%',
      }}
    >
      {/* Fixed header */}
      <div className="shrink-0" style={{ padding: '14px 14px 10px', borderBottom: '1px solid #F1F0EC' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <span
            className="font-poppins"
            style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.005em', color: '#1F2230' }}
          >
            Search criteria
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            icon={RotateCcw}
            className="h-7 px-2"
            style={{ fontSize: 11.5, color: '#5A6072' }}
          >
            Reset
          </Button>
        </div>
        <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
          Edit anything to re-run the search.
        </p>
      </div>

      {/* Scrolling body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <GroupSection
          label="Job titles"
          count={c.title_keywords?.length ?? 0}
          defaultOpen={(c.title_keywords?.length ?? 0) > 0}
          rightAdornment={<Badge tone="purple" size="xs" icon={Sparkles}>AI</Badge>}
        >
          <TokenField
            placeholder="e.g. Senior Product Designer"
            tags={c.title_keywords || []}
            onAdd={(tag) => onCriteriaChange({ title_keywords: [...(c.title_keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ title_keywords: (c.title_keywords || []).filter(t => t !== tag) })}
            tone="purple"
            autocompleteTable="standard_job_titles"
          />
        </GroupSection>

        <GroupSection
          label="Skills & keywords"
          count={c.keywords?.length ?? 0}
          defaultOpen={(c.keywords?.length ?? 0) > 0 || visibleSuggestions.length > 0}
        >
          <TokenField
            placeholder="Add skills…"
            tags={c.keywords || []}
            onAdd={(tag) => onCriteriaChange({ keywords: [...(c.keywords || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ keywords: (c.keywords || []).filter(t => t !== tag) })}
            tone="blue"
            autocompleteTable="standard_skills"
          />
          {visibleSuggestions.length > 0 && (
            <div>
              <p
                className="font-inter uppercase"
                style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: '0.06em', color: '#8B8F9E', margin: '10px 0 6px' }}
              >
                Suggested by Gio
              </p>
              <div className="flex flex-wrap" style={{ gap: 4 }}>
                {visibleSuggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onCriteriaChange({ keywords: [...(c.keywords || []), s] })}
                    className="inline-flex items-center font-inter transition-colors hover:brightness-95 focus:outline-none"
                    style={{
                      gap: 4,
                      padding: '3px 8px',
                      background: '#FAF8FF',
                      color: '#5B21B6',
                      border: '1px dashed #D7C5FB',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 500,
                    }}
                  >
                    <Plus style={{ width: 9, height: 9 }} />
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
          <LocationField
            selected={c.locations || []}
            onChange={(locations) => onCriteriaChange({ locations })}
          />
        </GroupSection>

        <GroupSection
          label="Seniority"
          count={c.seniorities?.length ?? 0}
          defaultOpen={(c.seniorities?.length ?? 0) > 0}
        >
          <CheckboxGroup
            options={SENIORITY_OPTIONS}
            selected={c.seniorities || []}
            onToggle={(v) => toggleArrayValue('seniorities', v)}
            maxVisible={6}
          />
        </GroupSection>

        <GroupSection
          label="Company Size"
          count={c.company_sizes?.length ?? 0}
          defaultOpen={(c.company_sizes?.length ?? 0) > 0}
        >
          <CheckboxGroup
            options={COMPANY_SIZE_OPTIONS}
            selected={c.company_sizes || []}
            onToggle={(v) => toggleArrayValue('company_sizes', v)}
            maxVisible={6}
          />
        </GroupSection>

        <GroupSection
          label="Industry"
          count={c.industries?.length ?? 0}
          defaultOpen={(c.industries?.length ?? 0) > 0}
        >
          <CheckboxGroup
            options={INDUSTRY_OPTIONS}
            selected={c.industries || []}
            onToggle={(v) => toggleArrayValue('industries', v)}
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
          <TokenField
            placeholder="Add company…"
            tags={c.company_names || []}
            onAdd={(tag) => onCriteriaChange({ company_names: [...(c.company_names || []), tag] })}
            onRemove={(tag) => onCriteriaChange({ company_names: (c.company_names || []).filter(t => t !== tag) })}
            tone="neutral"
          />
        </GroupSection>

        <GroupSection
          label="Experience (years)"
          count={expCount}
          defaultOpen={expCount > 0}
        >
          <DualRange
            min={0}
            max={30}
            minValue={c.experience_years?.min}
            maxValue={c.experience_years?.max}
            onChange={(v) => onCriteriaChange({ experience_years: { ...c.experience_years, min: v.min, max: v.max } })}
          />
        </GroupSection>

        <GroupSection label="Contact Info" count={contactCount}>
          <div>
            <CheckRow
              label="Has Email"
              checked={resultFilters.hasEmail === true}
              onToggle={() => onResultFiltersChange({ ...resultFilters, hasEmail: resultFilters.hasEmail ? undefined : true })}
            />
            <CheckRow
              label="Has Phone"
              checked={resultFilters.hasPhone === true}
              onToggle={() => onResultFiltersChange({ ...resultFilters, hasPhone: resultFilters.hasPhone ? undefined : true })}
            />
          </div>
        </GroupSection>

        <GroupSection label="Candidate Source" count={sourceCount}>
          <div>
            {([
              { value: 'internal' as const, label: 'Internal' },
              { value: 'gio' as const, label: 'Gio' },
              { value: 'external' as const, label: 'External' },
            ]).map(opt => {
              const selected = resultFilters.candidateSource || []
              const checked = selected.includes(opt.value)
              return (
                <CheckRow
                  key={opt.value}
                  label={opt.label}
                  checked={checked}
                  onToggle={() => {
                    const updated = checked
                      ? selected.filter(v => v !== opt.value)
                      : [...selected, opt.value]
                    onResultFiltersChange({ ...resultFilters, candidateSource: updated.length > 0 ? updated : undefined })
                  }}
                />
              )
            })}
          </div>
        </GroupSection>
      </div>

      {/* Fixed footer */}
      <div
        className="shrink-0 bg-white"
        style={{ padding: 12, borderTop: '1px solid #F1F0EC', display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <button
          type="button"
          onClick={handleSearch}
          disabled={(c.title_keywords?.length ?? 0) === 0}
          className={cn(
            'w-full inline-flex items-center justify-center font-poppins transition-opacity',
            (c.title_keywords?.length ?? 0) === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110',
          )}
          style={{
            height: 36,
            background: '#6F3FF5',
            color: '#fff',
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 600,
            gap: 6,
          }}
        >
          <Sparkles style={{ width: 13, height: 13 }} />
          Find candidates
        </button>
        <p
          className="font-inter text-center"
          style={{ fontSize: 10.5, color: '#8B8F9E' }}
        >
          Preview is free · Collect uses 1 credit each{collectRemaining != null && ` · ${collectRemaining} remaining`}
        </p>
      </div>
    </aside>
  )
}
