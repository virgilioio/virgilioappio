/**
 * Pipeline page filter bar — strict spec.
 * White card, padding 10. Controls wrap: Views pill, search, dropdown pills,
 * hairline divider, sort pill, Group toggle, Expand/Collapse all.
 */
import { Bookmark, Search, ChevronDown, ArrowUpDown, Rows3, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PILL_BASE =
  'inline-flex h-[30px] items-center gap-1.5 rounded-lg border px-3 font-inter text-[12px] font-medium transition-colors'

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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        PILL_BASE,
        active
          ? 'border-[#D7C5FB] bg-[#EDE4FF] text-[#5B21B6] hover:bg-[#E3D5FB]'
          : 'border-[#E7E8EE] bg-white text-[#1F2230] hover:bg-[#FAFAF7]',
      )}
    >
      {children}
    </button>
  )
}

export interface PipelineFilterBarProps {
  search: string
  onSearchChange: (v: string) => void
  status: string
  onStatusClick?: () => void
  owner: string
  onOwnerClick?: () => void
  department: string
  onDepartmentClick?: () => void
  grouped: boolean
  onToggleGroup: () => void
  allExpanded: boolean
  onToggleExpandAll: () => void
  onViewsClick?: () => void
  onSortClick?: () => void
}

export function PipelineFilterBar(props: PipelineFilterBarProps) {
  const {
    search,
    onSearchChange,
    status,
    onStatusClick,
    owner,
    onOwnerClick,
    department,
    onDepartmentClick,
    grouped,
    onToggleGroup,
    allExpanded,
    onToggleExpandAll,
    onViewsClick,
    onSortClick,
  } = props

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

      <Pill active onClick={onStatusClick}>
        Status · {status}
        <ChevronDown size={12} strokeWidth={2} />
      </Pill>
      <Pill onClick={onOwnerClick}>
        Owner · {owner}
        <ChevronDown size={12} strokeWidth={2} />
      </Pill>
      <Pill onClick={onDepartmentClick}>
        Department · {department}
        <ChevronDown size={12} strokeWidth={2} />
      </Pill>

      <div className="mx-1 h-5 w-px" style={{ background: '#E7E8EE' }} />

      <Pill onClick={onSortClick}>
        <ArrowUpDown size={12} strokeWidth={2} />
        Recent activity
      </Pill>
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
