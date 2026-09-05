import * as React from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HIDE_IN_PIPELINE,
  HIDE_PREVIOUSLY_REJECTED,
  formatMatchAge,
  makeLocationFilter,
  makeMatchFilter,
  makeRecencyFilter,
  makeSeniorityFilter,
  makeSkillFilter,
  type SuggestedFilter,
} from './suggestedFilters'

export type SuggestedState = 'loading' | 'results' | 'empty' | 'noresults'

const nf = new Intl.NumberFormat('en-US')
const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

/** A single filter chip — active (lilac) or the "Add filter" affordance (white). */
export function SugFilterChip({
  label,
  value,
  onClick,
  variant = 'active',
}: {
  label: string
  value?: string
  onClick?: () => void
  variant?: 'active' | 'add'
}) {
  const active = variant === 'active'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 9px',
        borderRadius: 999,
        fontFamily: inter,
        fontSize: 11.5,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        background: active ? '#EDE4FF' : '#fff',
        border: active ? '1px solid #D7C5FB' : '1px solid #E7E8EE',
        color: active ? '#6F3FF5' : '#5A6072',
      }}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
    >
      {!active && <Plus size={11} strokeWidth={2.2} />}
      <span>{label}</span>
      {value && <span style={{ color: '#4B2BB0', fontWeight: 600 }}>{value}</span>}
      {active && <X size={10} strokeWidth={2.2} />}
    </button>
  )
}

export interface SuggestedToolbarProps {
  state: SuggestedState
  total: number
  shown: number
  searched: number
  updatedAt?: Date | number | null
  filters: SuggestedFilter[]
  onRemoveFilter: (id: string) => void
  onAddFilter: (filter: SuggestedFilter) => void
  onRefresh: () => void
  skillOptions?: string[]
  locationOptions?: string[]
}

/**
 * The strip between the section tabs and the table: a sentence describing the
 * current state, plus the filters that produced it. Every number is a prop.
 */
export function SuggestedToolbar({
  state,
  total,
  shown,
  searched,
  updatedAt,
  filters,
  onRemoveFilter,
  onAddFilter,
  onRefresh,
  skillOptions = [],
  locationOptions = [],
}: SuggestedToolbarProps) {
  const age = formatMatchAge(updatedAt)
  const hidden = Math.max(total - shown, 0)
  const has = (id: string) => filters.some((f) => f.id === id)
  const muted = { color: '#8B8F9E' }

  const heading =
    state === 'loading'
      ? 'Finding suggestions'
      : state === 'results'
        ? `${nf.format(total)} suggested from your database`
        : state === 'empty'
          ? 'No suggestions yet'
          : 'No suggestions match your filters'

  const subline =
    state === 'loading' ? (
      <>This usually takes a few seconds.</>
    ) : state === 'results' ? (
      <>
        Ranked against this job's requirements · {nf.format(searched)} profiles searched
        {age && <span style={muted}> · updated {age}</span>}
      </>
    ) : state === 'empty' ? (
      <>
        {nf.format(searched)} profiles searched · no overlap with this job's requirements
        {age && <span style={muted}> · updated {age}</span>}
      </>
    ) : (
      <>
        {nf.format(total)} suggestions found ·{' '}
        <span style={{ color: '#0d0d09', fontWeight: 600 }}>{nf.format(hidden)}</span> hidden by{' '}
        {filters.length} {filters.length === 1 ? 'filter' : 'filters'}
      </>
    )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 12,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: poppins,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: '#0d0d09',
            }}
          >
            {heading}
          </span>
          {state === 'results' && (
            <span
              style={{
                padding: '2px 7px',
                borderRadius: 999,
                background: '#EDE4FF',
                color: '#4B2BB0',
                fontFamily: inter,
                fontSize: 10.5,
                fontWeight: 600,
              }}
            >
              Gio match
            </span>
          )}
        </div>
        <div style={{ marginTop: 3, fontFamily: inter, fontSize: 12, color: '#5A6072' }}>{subline}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {filters.map((f) => (
          <SugFilterChip
            key={f.id}
            label={f.label}
            value={f.value}
            onClick={() => onRemoveFilter(f.id)}
          />
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span>
              <SugFilterChip label="Add filter" variant="add" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56">
            <DropdownMenuLabel>Narrow the list</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Match floor</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[60, 70, 80, 90].map((m) => (
                  <DropdownMenuItem key={m} onSelect={() => onAddFilter(makeMatchFilter(m))}>
                    ≥ {m}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Seniority</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[3, 5, 8, 12].map((y) => (
                  <DropdownMenuItem key={y} onSelect={() => onAddFilter(makeSeniorityFilter(y))}>
                    {y}+ yrs
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {locationOptions.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Location</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[280px] overflow-y-auto">
                  {locationOptions.map((l) => (
                    <DropdownMenuItem key={l} onSelect={() => onAddFilter(makeLocationFilter(l))}>
                      {l}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {skillOptions.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Skill</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-[280px] overflow-y-auto">
                  {skillOptions.map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => onAddFilter(makeSkillFilter(s))}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Last activity</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[30, 90, 180].map((d) => (
                  <DropdownMenuItem key={d} onSelect={() => onAddFilter(makeRecencyFilter(d))}>
                    last {d} days
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {!has(HIDE_IN_PIPELINE.id) && (
              <DropdownMenuItem onSelect={() => onAddFilter(HIDE_IN_PIPELINE)}>
                Hide in pipeline
              </DropdownMenuItem>
            )}
            {!has(HIDE_PREVIOUSLY_REJECTED.id) && (
              <DropdownMenuItem onSelect={() => onAddFilter(HIDE_PREVIOUSLY_REJECTED)}>
                Hide previously rejected
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div style={{ width: 1, height: 20, background: '#E7E8EE', margin: '0 2px' }} />

        <Button
          variant="secondary"
          size="sm"
          icon={RefreshCw}
          onClick={onRefresh}
          disabled={state === 'loading'}
        >
          Refresh
        </Button>
      </div>
    </div>
  )
}

export default SuggestedToolbar
