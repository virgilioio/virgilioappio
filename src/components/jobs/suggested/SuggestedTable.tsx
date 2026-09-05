import * as React from 'react'
import { ArrowDown, ArrowUp, Plus, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SUGGESTED_COLUMNS,
  SUGGESTED_GRID,
  suggestedRowStyle,
  type SuggestedSortKey,
} from './suggestedGrid'
import {
  SugCheckbox,
  SugLocationCell,
  SugMatchCell,
  SugReasons,
  SugStatusCell,
} from './SuggestedAtoms'
import {
  formatLastActive,
  lastActivityAt,
  suggestedCandidateId,
  suggestedReasons,
  suggestedScore,
} from './suggestedFilters'
import type { SuggestedStatus } from '@/hooks/useSuggestedCandidateStatus'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || '?'

export interface SuggestedTableProps {
  candidates: any[]
  statuses: Record<string, SuggestedStatus>
  jobSkills?: string[] | null
  jobLocation?: string | null
  selected: Set<string>
  onToggle: (id: string, next: boolean) => void
  onToggleAll: (next: boolean) => void
  sort: { key: SuggestedSortKey; dir: 'asc' | 'desc' }
  onSort: (key: SuggestedSortKey) => void
  onOpen: (candidate: any) => void
  onAdd: (candidate: any) => void
  onDismiss: (candidate: any) => void
  addingId?: string | null
}

function locationFits(candidate: any, jobLocation?: string | null): boolean | null {
  const loc = [candidate?.location, candidate?.location_city, candidate?.location_country]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (!loc || !jobLocation) return null
  const parts = String(jobLocation)
    .toLowerCase()
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return null
  return parts.some((p) => loc.includes(p))
}

/** Header, rows and cells all share ONE grid template. */
export function SuggestedTable({
  candidates,
  statuses,
  jobSkills,
  jobLocation,
  selected,
  onToggle,
  onToggleAll,
  sort,
  onSort,
  onOpen,
  onAdd,
  onDismiss,
  addingId,
}: SuggestedTableProps) {
  const [hovered, setHovered] = React.useState<string | null>(null)
  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(suggestedCandidateId(c)))

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div
        role="row"
        style={{
          display: 'grid',
          gridTemplateColumns: SUGGESTED_GRID,
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 36,
          background: '#FAFAF7',
          borderBottom: '1px solid #E7E8EE',
        }}
      >
        {SUGGESTED_COLUMNS.map((col) => {
          if (col.key === 'select') {
            return (
              <SugCheckbox
                key={col.key}
                checked={allSelected}
                onChange={onToggleAll}
                label="Select all suggestions"
              />
            )
          }
          const sortable = col.sortable
          const isActive = sortable && sort.key === (col.key as SuggestedSortKey)
          const Arrow = sort.dir === 'asc' ? ArrowUp : ArrowDown
          const content = (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: inter,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isActive ? '#0d0d09' : '#8B8F9E',
              }}
            >
              {col.label}
              {isActive && <Arrow size={10} strokeWidth={2.4} />}
            </span>
          )
          return (
            <div key={col.key} style={{ textAlign: col.align === 'right' ? 'right' : 'left', minWidth: 0 }}>
              {sortable ? (
                <button
                  type="button"
                  onClick={() => onSort(col.key as SuggestedSortKey)}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
                >
                  {content}
                </button>
              ) : (
                content
              )}
            </div>
          )
        })}
      </div>

      {candidates.map((c, i) => {
        const id = suggestedCandidateId(c)
        const name = c.full_name || c.name || 'Unnamed candidate'
        const role = [c.current_role || c.role_current, c.current_company || c.company]
          .filter(Boolean)
          .join(' · ')
        const isSelected = selected.has(id)
        const isHovered = hovered === id
        const reasons = suggestedReasons(c, jobSkills)
        const active = formatLastActive(lastActivityAt(c))
        const status = statuses[id] || { kind: 'free' as const }

        return (
          <div
            key={id || i}
            role="row"
            tabIndex={0}
            onClick={() => onOpen(c)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(c)
            }}
            onMouseEnter={() => setHovered(id)}
            onMouseLeave={() => setHovered((h) => (h === id ? null : h))}
            style={{
              ...suggestedRowStyle,
              cursor: 'pointer',
              borderBottom: i === candidates.length - 1 ? 'none' : '1px solid #F1F0EC',
              borderLeft: isSelected ? '2px solid #6F3FF5' : '2px solid transparent',
              background: isSelected ? '#FAF8FF' : isHovered ? '#FAFAF7' : '#fff',
            }}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
          >
            <SugCheckbox
              checked={isSelected}
              onChange={(next) => onToggle(id, next)}
              label={`Select ${name}`}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: '#F1F0EC',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: poppins,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#5A6072',
                }}
              >
                {initials(name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: poppins,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: '#0d0d09',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {name}
                </div>
                {role && (
                  <div
                    style={{
                      fontFamily: inter,
                      fontSize: 11.5,
                      color: '#5A6072',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {role}
                  </div>
                )}
              </div>
            </div>

            <SugReasons reasons={reasons} />

            <SugMatchCell score={suggestedScore(c)} />

            <SugLocationCell
              location={c.location || c.location_city || null}
              fits={locationFits(c, jobLocation)}
            />

            <div style={{ fontFamily: inter, fontSize: 11.5, color: '#5A6072', whiteSpace: 'nowrap' }}>
              {active ? (
                <>
                  <span style={{ color: '#1F2230' }}>{active.value}</span>
                  <span style={{ color: '#8B8F9E' }}>{active.suffix}</span>
                </>
              ) : (
                '—'
              )}
            </div>

            <SugStatusCell status={status} />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 6,
                opacity: isHovered || isSelected ? 1 : 0,
                transition: 'opacity 120ms ease',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="xs"
                variant="secondary"
                icon={Plus}
                loading={addingId === id}
                onClick={() => onAdd(c)}
              >
                Add
              </Button>
              <Button
                size="xs"
                variant="ghost"
                icon={ThumbsDown}
                iconOnly
                aria-label={`Not a fit: ${name}`}
                onClick={() => onDismiss(c)}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SuggestedTable
