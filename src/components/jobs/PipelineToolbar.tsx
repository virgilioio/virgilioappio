import * as React from 'react'
import { Search, X, LayoutGrid, List } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SugFilterChip } from '@/components/jobs/suggested/SuggestedToolbar'
import {
  PIPELINE_FILTER_MENU,
  upsertPipelineFilter,
  type PipelineFilter,
} from '@/components/jobs/pipelineFilters'

/**
 * One thin row: state on the left (active filter chips), view controls on the
 * right (expanding search + Board/List). No card, no border, no background.
 */
export function PipelineToolbar({
  filters,
  onFiltersChange,
  search,
  onSearchChange,
  view,
  onViewChange,
  showViewToggle = false,
}: {
  filters: PipelineFilter[]
  onFiltersChange: (next: PipelineFilter[]) => void
  search: string
  onSearchChange: (v: string) => void
  view?: 'board' | 'list'
  onViewChange?: (v: 'board' | 'list') => void
  showViewToggle?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const expanded = open || search.length > 0

  // "/" focuses search from anywhere on the surface.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing =
        t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        setOpen(true)
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const iconBtn: React.CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#fff',
    border: '1px solid #E7E8EE',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#5A6072',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  }

  const segBtn = (active: boolean): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 7,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 0,
    cursor: 'pointer',
    background: active ? '#0d0d09' : 'transparent',
    color: active ? '#fffcf9' : '#8B8F9E',
    padding: 0,
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 4px',
      }}
    >
      {/* Left — the filters themselves, not a count. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {filters.map((f) => (
          <SugFilterChip
            key={f.id}
            label={f.label}
            value={f.value}
            onClick={() => onFiltersChange(filters.filter((x) => x.id !== f.id))}
          />
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span>
              <SugFilterChip label="＋ Add filter" variant="add" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-[220px]">
            {PIPELINE_FILTER_MENU.map((group, gi) => (
              <React.Fragment key={group.group}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{group.group}</DropdownMenuLabel>
                {group.options.map((o) => (
                  <DropdownMenuItem
                    key={o.key}
                    onSelect={() => onFiltersChange(upsertPipelineFilter(filters, o.filter))}
                  >
                    {o.label}
                  </DropdownMenuItem>
                ))}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right — how you're looking at it. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: '#fff',
            border: '1px solid #E7E8EE',
            borderRadius: 8,
            height: 32,
            padding: expanded ? '0 8px' : 0,
            width: expanded ? 240 : 32,
            transition: 'width 160ms ease-out, padding 160ms ease-out',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            title="Search in pipeline"
            aria-label="Search in pipeline"
            onClick={() => {
              setOpen(true)
              requestAnimationFrame(() => inputRef.current?.focus())
            }}
            style={{ ...iconBtn, width: 20, height: 20, border: 0, background: 'transparent' }}
          >
            <Search size={15} strokeWidth={2} />
          </button>
          {expanded && (
            <>
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search in pipeline…"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onSearchChange('')
                    setOpen(false)
                    inputRef.current?.blur()
                  }
                }}
                onBlur={() => {
                  if (!search) setOpen(false)
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 12.5,
                  color: '#0d0d09',
                }}
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    onSearchChange('')
                    setOpen(false)
                  }}
                  style={{ background: 'none', border: 0, cursor: 'pointer', color: '#8B8F9E', padding: 0, display: 'inline-flex' }}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              )}
            </>
          )}
        </div>

        {showViewToggle && view && onViewChange && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              padding: 3,
              borderRadius: 9,
              background: '#fff',
              border: '1px solid #E7E8EE',
            }}
          >
            <button
              type="button"
              title="Board"
              aria-pressed={view === 'board'}
              onClick={() => onViewChange('board')}
              style={segBtn(view === 'board')}
            >
              <LayoutGrid size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              title="List"
              aria-pressed={view === 'list'}
              onClick={() => onViewChange('list')}
              style={segBtn(view === 'list')}
            >
              <List size={14} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PipelineToolbar
