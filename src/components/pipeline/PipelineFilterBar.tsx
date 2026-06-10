/**
 * Pipeline page filter bar — strict spec.
 * White card, padding 10. Controls wrap: Views pill, search, dropdown pills
 * (Status / Owner / Department), hairline divider, Sort pill, Group toggle,
 * Expand/Collapse all.
 *
 * Status and Sort use a single-select DropdownMenu.
 * Owner and Department use a multi-select Popover with checkboxes + Apply/Clear.
 */
import { useMemo, useState } from 'react'
import {
  Bookmark,
  Search,
  ChevronDown,
  ArrowUpDown,
  Rows3,
  Maximize2,
  Minimize2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const PILL_BASE =
  'inline-flex h-[30px] items-center gap-1.5 rounded-lg border px-3 font-inter text-[12px] font-medium transition-colors'

function pillClass(active?: boolean) {
  return cn(
    PILL_BASE,
    active
      ? 'border-[#D7C5FB] bg-[#EDE4FF] text-[#5B21B6] hover:bg-[#E3D5FB]'
      : 'border-[#E7E8EE] bg-white text-[#1F2230] hover:bg-[#FAFAF7]',
  )
}

function Pill({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={pillClass(active)}>
      {children}
    </button>
  )
}

export type PipelineStatus = 'all' | 'open' | 'draft' | 'closed' | 'archived'
export type PipelineSort = 'recent' | 'oldest' | 'title' | 'active'

const STATUS_OPTIONS: { value: PipelineStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Draft' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
]

const SORT_OPTIONS: { value: PipelineSort; label: string }[] = [
  { value: 'recent', label: 'Recent activity' },
  { value: 'oldest', label: 'Oldest activity' },
  { value: 'title', label: 'Job title (A→Z)' },
  { value: 'active', label: 'Active candidates' },
]

export interface FilterOption {
  value: string
  label: string
}

export interface PipelineFilterBarProps {
  search: string
  onSearchChange: (v: string) => void

  status: PipelineStatus
  onStatusChange: (v: PipelineStatus) => void

  ownerOptions: FilterOption[]
  selectedOwners: string[]
  onSelectedOwnersChange: (v: string[]) => void

  departmentOptions: FilterOption[]
  selectedDepartments: string[]
  onSelectedDepartmentsChange: (v: string[]) => void

  sortBy: PipelineSort
  onSortChange: (v: PipelineSort) => void

  grouped: boolean
  onToggleGroup: () => void
  allExpanded: boolean
  onToggleExpandAll: () => void
  onViewsClick?: () => void
}

function MultiSelectPill({
  label,
  options,
  selected,
  onChange,
  searchable = true,
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>(selected)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, search])

  const summary = useMemo(() => {
    if (selected.length === 0) return label === 'Owner' ? 'Anyone' : 'All'
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? '1 selected'
    }
    return `${selected.length} selected`
  }, [selected, options, label])

  const toggle = (value: string) => {
    setDraft((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setDraft(selected)
          setSearch('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className={pillClass(selected.length > 0)}>
          {label} · {summary}
          <ChevronDown size={12} strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[260px] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-menu-group font-inter uppercase text-[hsl(var(--menu-group-color))]">
            {label}
          </span>
          {draft.length > 0 && (
            <button
              type="button"
              onClick={() => setDraft([])}
              className="text-[11px] text-text-tertiary hover:text-foreground font-inter"
            >
              Clear
            </button>
          )}
        </div>

        {searchable && options.length > 7 && (
          <div className="px-2 pb-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 text-[12px]"
            />
          </div>
        )}

        <div className="max-h-[260px] overflow-y-auto px-1 pb-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center font-inter text-[12px] text-[hsl(var(--menu-group-color))]">
              No results
            </div>
          ) : (
            filtered.map((opt) => {
              const checked = draft.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex h-[30px] w-full items-center gap-2 rounded-[8px] px-2 font-inter text-[12.5px] text-foreground transition-colors hover:bg-[hsl(var(--menu-hover))]"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-2 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onChange(draft)
              setOpen(false)
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function PipelineFilterBar(props: PipelineFilterBarProps) {
  const {
    search,
    onSearchChange,
    status,
    onStatusChange,
    ownerOptions,
    selectedOwners,
    onSelectedOwnersChange,
    departmentOptions,
    selectedDepartments,
    onSelectedDepartmentsChange,
    sortBy,
    onSortChange,
    grouped,
    onToggleGroup,
    allExpanded,
    onToggleExpandAll,
    onViewsClick,
  } = props

  const statusLabel =
    STATUS_OPTIONS.find((o) => o.value === status)?.label ?? 'Open'
  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Recent activity'

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-[12px] bg-white"
      style={{ border: '1px solid #E7E8EE', padding: 10 }}
    >
      <Pill onClick={onViewsClick}>
        <Bookmark size={13} strokeWidth={2} />
        Views
      </Pill>

      <div
        className="relative flex h-[30px] min-w-[220px] flex-1 items-center rounded-lg"
        style={{ background: '#F6F5F1' }}
      >
        <Search size={13} strokeWidth={2} className="absolute left-2.5 text-[#8B8F9E]" />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search jobs…"
          className="h-full w-full rounded-lg bg-transparent pl-8 pr-3 font-inter text-[12px] text-[#1F2230] placeholder:text-[#8B8F9E] focus:outline-none"
        />
      </div>

      {/* Status (single-select) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={pillClass(status !== 'open')}>
            Status · {statusLabel}
            <ChevronDown size={12} strokeWidth={2} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[180px]">
          <DropdownMenuRadioGroup value={status} onValueChange={(v) => onStatusChange(v as PipelineStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value} className="pl-2">
                <span className="flex w-4 items-center justify-center">
                  {status === o.value ? <Check size={12} strokeWidth={2.5} /> : null}
                </span>
                <span className="ml-1">{o.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Owner (multi-select) */}
      <MultiSelectPill
        label="Owner"
        options={ownerOptions}
        selected={selectedOwners}
        onChange={onSelectedOwnersChange}
      />

      {/* Department (multi-select) */}
      <MultiSelectPill
        label="Department"
        options={departmentOptions}
        selected={selectedDepartments}
        onChange={onSelectedDepartmentsChange}
      />

      <div className="mx-1 h-5 w-px" style={{ background: '#E7E8EE' }} />

      {/* Sort (single-select) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={pillClass(sortBy !== 'recent')}>
            <ArrowUpDown size={12} strokeWidth={2} />
            {sortLabel}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[200px]">
          <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => onSortChange(v as PipelineSort)}>
            {SORT_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value} className="pl-2">
                <span className="flex w-4 items-center justify-center">
                  {sortBy === o.value ? <Check size={12} strokeWidth={2.5} /> : null}
                </span>
                <span className="ml-1">{o.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Pill active={grouped} onClick={onToggleGroup}>
        <Rows3 size={12} strokeWidth={2} />
        Group
      </Pill>
      <Pill onClick={onToggleExpandAll}>
        {allExpanded ? <Minimize2 size={12} strokeWidth={2} /> : <Maximize2 size={12} strokeWidth={2} />}
        {allExpanded ? 'Collapse all' : 'Expand all'}
      </Pill>
    </div>
  )
}
