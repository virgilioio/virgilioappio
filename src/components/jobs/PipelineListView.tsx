import * as React from 'react'
import { Check, ChevronDown, Minus, Clock, MoreHorizontal, Sparkles, ArrowRight, Heart } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LIST_GRID,
  scoreColor,
  isStale,
  PIPELINE_RED,
  PIPELINE_MUTED,
  PIPELINE_TERTIARY,
  PIPELINE_PURPLE,
} from './pipelineVisuals'
import PipelineStatusBadge from './PipelineStatusBadge'
import type { CandidateStatusInfo } from '@/hooks/usePipelineCandidateStatuses'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { IconTip } from '@/components/ui/tooltip'

export type PipelineListRow = {
  id: string
  candidateId: string
  name: string
  role?: string | null
  company?: string | null
  score?: number | null
  days: number
  /** The single engine-assigned status — rendered as-is. */
  status?: CandidateStatusInfo | null
  ownerName?: string | null
  ownerAvatarUrl?: string | null
  isFavorite?: boolean
}


export type PipelineListGroup = {
  jhsId: string
  name: string
  color: string
  rows: PipelineListRow[]
}

/**
 * Phones (below the shell's 640px line): no column header; each row is
 * tick · candidate (name, role @ company, then match · days · status) · move.
 * Ticks and the move button stay visible because there is no hover on touch.
 */
const PHONE_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '20px minmax(0,1fr) auto',
  alignItems: 'center',
  gap: 10,
}

const HEADER_LABEL: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.055em',
  textTransform: 'uppercase',
  color: PIPELINE_TERTIARY,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

function Tick({
  size,
  checked,
  onClick,
}: {
  size: 14 | 16
  /** 'mixed': some of this stage's candidates are selected (§14 indeterminate parent). */
  checked: boolean | 'mixed'
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label="Select"
      className="inline-flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        border: checked ? 'none' : '1.5px solid #C2C6D2',
        background: checked ? '#0d0d09' : '#fff',
        transition: 'background-color 120ms ease',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(e)
      }}
    >
      {checked === 'mixed' ? (
        <Minus size={size === 14 ? 9 : 10} strokeWidth={3} color="#fffcf9" />
      ) : checked ? (
        <Check size={size === 14 ? 9 : 10} strokeWidth={3} color="#fffcf9" />
      ) : null}
    </button>
  )
}

export function PipelineListView({
  groups,
  stages,
  selectedIds,
  onToggleRow,
  onToggleStage,
  onRowClick,
  onMove,
}: {
  groups: PipelineListGroup[]
  stages: { jhsId: string; name: string }[]
  selectedIds: Set<string>
  onToggleRow: (assocId: string, stageJhsId: string, e: React.MouseEvent) => void
  onToggleStage: (stageJhsId: string) => void
  onRowClick: (candidateId: string) => void
  onMove: (assocId: string, toStageJhsId: string) => void
}) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({})
  const phone = useIsMobile()
  const GRID = phone ? PHONE_GRID : LIST_GRID
  const pad = phone ? '10px 12px 10px 11px' : '10px 16px 10px 13px'

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      {!phone && (
      <div
        style={{
          ...LIST_GRID,
          padding: '10px 16px 10px 13px',
          background: '#fff',
          borderBottom: '1px solid #E7E8EE',
          flexShrink: 0,
        }}
      >
        <div />
        <div style={HEADER_LABEL}>Candidate</div>
        <div style={{ ...HEADER_LABEL, textAlign: 'right' }}>Match</div>
        <div style={HEADER_LABEL}>Time in stage</div>
        <div style={HEADER_LABEL}>Status</div>
        <div style={HEADER_LABEL}>Owner</div>
        <div />
      </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {groups.map((group) => {
          const isCollapsed = !!collapsed[group.jhsId]
          const stageSelected = group.rows.filter((r) => selectedIds.has(r.id))
          const allSelected = group.rows.length > 0 && stageSelected.length === group.rows.length
          const anySelected = stageSelected.length > 0
          return (
            <div key={group.jhsId}>
              {/* Stage group header */}
              <div
                style={{
                  ...GRID,
                  position: 'sticky',
                  top: 0,
                  zIndex: 5,
                  padding: phone ? '9px 12px 9px 11px' : '9px 16px 9px 13px',
                  borderLeft: `3px solid ${group.color}`,
                  background: '#FAFAF7',
                  borderTop: '1px solid #E7E8EE',
                  borderBottom: '1px solid #E7E8EE',
                }}
              >
                <Tick size={16} checked={allSelected ? true : anySelected ? 'mixed' : false} onClick={() => onToggleStage(group.jhsId)} />
                <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
                  <button
                    type="button"
                    aria-label={isCollapsed ? 'Expand stage' : 'Collapse stage'}
                    className="inline-flex items-center justify-center shrink-0"
                    style={{ width: 18, height: 18, borderRadius: 5, color: PIPELINE_TERTIARY }}
                    onClick={() => setCollapsed((p) => ({ ...p, [group.jhsId]: !p[group.jhsId] }))}
                  >
                    <ChevronDown
                      size={13}
                      strokeWidth={2.4}
                      style={{
                        transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                        transition: 'transform 140ms ease',
                      }}
                    />
                  </button>
                  <span
                    aria-hidden
                    className="shrink-0"
                    style={{ width: 8, height: 8, borderRadius: 999, background: group.color }}
                  />
                  <span
                    className="truncate"
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 12.5,
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      color: '#0d0d09',
                    }}
                  >
                    {group.name}
                  </span>
                  <span
                    className="shrink-0"
                    style={{
                      padding: '1px 6px',
                      borderRadius: 999,
                      background: '#F1F0EC',
                      color: PIPELINE_MUTED,
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}
                  >
                    {group.rows.length}
                  </span>
                  {anySelected && (
                    <span
                      className="shrink-0"
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: PIPELINE_PURPLE }}
                    >
                      {stageSelected.length} selected
                    </span>
                  )}
                </div>
                {!phone && (
                  <>
                    <div />
                    <div />
                    <div />
                    <div />
                  </>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    aria-label="Stage actions"
                    className="inline-flex items-center justify-center"
                    style={{ width: phone ? 32 : 24, height: phone ? 32 : 24, borderRadius: 6, color: PIPELINE_TERTIARY }}
                    onClick={() => onToggleStage(group.jhsId)}
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              </div>

              {!isCollapsed && group.rows.length === 0 && (
                <div
                  style={{
                    padding: '14px 16px 14px 32px',
                    borderLeft: `3px solid ${group.color}22`,
                    borderBottom: '1px solid #F1F0EC',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 12,
                    color: PIPELINE_TERTIARY,
                  }}
                >
                  Nobody in this stage.
                </div>
              )}

              {!isCollapsed &&
                group.rows.map((row) => {
                  const selected = selectedIds.has(row.id)
                  const stale = isStale(row.days)
                  return (
                    <div
                      key={row.id}
                      className={cn('group/row cursor-pointer', group.rows.length > 100 && 'gio-cv-row')}
                      style={{
                        ...GRID,
                        minHeight: 56,
                        padding: pad,
                        borderLeft: `3px solid ${group.color}22`,
                        borderBottom: '1px solid #F1F0EC',
                        background: selected ? '#FAF8FF' : '#fff',
                      }}
                      onMouseEnter={(e) => {
                        if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#FAFAF7'
                      }}
                      onMouseLeave={(e) => {
                        if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#fff'
                      }}
                      onClick={() => onRowClick(row.candidateId)}
                    >
                      {/* 1 · select */}
                      <div
                        className="transition-opacity duration-100"
                        style={{ opacity: selected || anySelected ? 1 : undefined }}
                      >
                        <span
                          className={
                            selected || anySelected || phone
                              ? 'opacity-100'
                              : 'opacity-0 group-hover/row:opacity-100 inline-block'
                          }
                        >
                          <Tick
                            size={14}
                            checked={selected}
                            onClick={(e) => onToggleRow(row.id, group.jhsId, e)}
                          />
                        </span>
                      </div>

                      {/* 2 · candidate */}
                      <div style={{ minWidth: 0, maxWidth: '100%' }} className="overflow-hidden">
                        <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
                          <span
                            className="truncate"
                            style={{
                              fontFamily: 'Poppins, sans-serif',
                              fontSize: 13,
                              fontWeight: 600,
                              letterSpacing: '-0.005em',
                              color: '#1F2230',
                            }}
                            title={row.name}
                          >
                            {row.name}
                          </span>
                          {row.isFavorite && <Heart size={11} color={PIPELINE_RED} fill={PIPELINE_RED} />}
                        </div>
                        <div
                          className="truncate"
                          style={{
                            marginTop: 1,
                            fontFamily: 'Inter, sans-serif',
                            fontSize: 11.5,
                            color: PIPELINE_MUTED,
                          }}
                          title={[row.role, row.company].filter(Boolean).join(' @ ')}
                        >
                          {row.role || '—'}
                          {row.company && (
                            <>
                              {' '}
                              <span style={{ color: PIPELINE_TERTIARY }}>@</span>{' '}
                              <span style={{ color: '#1F2230', fontWeight: 500 }}>{row.company}</span>
                            </>
                          )}
                        </div>
                        {phone && (
                          <div
                            className="flex flex-wrap items-center"
                            style={{ marginTop: 6, gap: '4px 10px', fontFamily: 'Inter, sans-serif', fontSize: 12 }}
                          >
                            <span className="inline-flex items-center tabular-nums" style={{ gap: 3, color: scoreColor(row.score) }}>
                              <Sparkles size={11} strokeWidth={2.25} />
                              <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>
                                {typeof row.score === 'number' ? row.score : '—'}
                              </span>
                            </span>
                            <span className="inline-flex items-center tabular-nums" style={{ gap: 3 }}>
                              {stale && <Clock size={11} strokeWidth={2.2} color={PIPELINE_RED} />}
                              <span style={{ color: stale ? PIPELINE_RED : undefined, fontWeight: stale ? 600 : undefined }}>
                                {row.days}d
                              </span>
                              <span style={{ color: PIPELINE_TERTIARY }}>in stage</span>
                            </span>
                            <span className="inline-flex min-w-0 max-w-full items-center">
                              <PipelineStatusBadge status={row.status} />
                            </span>
                          </div>
                        )}
                      </div>

                      {!phone && (
                      <>

                      {/* 3 · match */}
                      <div
                        className="flex items-center justify-end"
                        style={{ gap: 4, color: scoreColor(row.score) }}
                      >
                        <Sparkles size={11} strokeWidth={2.25} />
                        <span
                          style={{
                            fontFamily: 'Poppins, sans-serif',
                            fontSize: 13.5,
                            fontWeight: 600,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {typeof row.score === 'number' ? row.score : '—'}
                        </span>
                      </div>

                      {/* 4 · time in stage */}
                      <div
                        className="flex items-center"
                        style={{ gap: 4, fontFamily: 'Inter, sans-serif', fontSize: 12 }}
                      >
                        {stale && <Clock size={11} strokeWidth={2.2} color={PIPELINE_RED} />}
                        <span style={{ color: stale ? PIPELINE_RED : undefined, fontWeight: stale ? 600 : undefined }}>
                          {row.days}d
                        </span>
                        <span style={{ color: PIPELINE_TERTIARY }}>in stage</span>
                      </div>

                      {/* 5 · status */}
                      <div className="flex items-center" style={{ minWidth: 0 }}>
                        <PipelineStatusBadge status={row.status} />
                      </div>


                      {/* 6 · owner */}
                      <div className="flex items-center" style={{ gap: 6, minWidth: 0 }}>
                        {row.ownerName ? (
                          <>
                            <Avatar style={{ width: 20, height: 20 }}>
                              {row.ownerAvatarUrl && <AvatarImage src={row.ownerAvatarUrl} alt={row.ownerName} />}
                              <AvatarFallback style={{ fontSize: 9 }}>
                                {row.ownerName
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((p) => p[0]?.toUpperCase())
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className="truncate"
                              style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: PIPELINE_MUTED }}
                            >
                              {row.ownerName}
                            </span>
                          </>
                        ) : (
                          <span
                            style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: PIPELINE_TERTIARY }}
                          >
                            —
                          </span>
                        )}
                      </div>

                      </>
                      )}

                      {/* 7 · actions */}
                      <div
                        className={
                          selected || phone
                            ? 'flex items-center justify-end opacity-100'
                            : 'flex items-center justify-end opacity-0 group-hover/row:opacity-100 transition-opacity duration-[120ms]'
                        }
                        style={{ gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <IconTip label="Move stage">
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Move stage"
                              className="inline-flex items-center justify-center"
                              style={{
                                width: phone ? 32 : 26,
                                height: phone ? 32 : 26,
                                borderRadius: 7,
                                border: '1px solid #E7E8EE',
                                background: '#fff',
                              }}
                            >
                              <ArrowRight size={12} />
                            </button>
                          </DropdownMenuTrigger>
                          </IconTip>
                          <DropdownMenuContent align="end" sideOffset={8}>
                            {stages
                              .filter((s) => s.jhsId !== group.jhsId)
                              .map((s) => (
                                <DropdownMenuItem key={s.jhsId} onSelect={() => onMove(row.id, s.jhsId)}>
                                  {s.name}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {!phone && (
                        <DropdownMenu>
                          <IconTip label="More">
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="More"
                              className="inline-flex items-center justify-center"
                              style={{ width: 26, height: 26, borderRadius: 7, color: PIPELINE_TERTIARY }}
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </DropdownMenuTrigger>
                          </IconTip>
                          <DropdownMenuContent align="end" sideOffset={8}>
                            <DropdownMenuItem onSelect={() => onRowClick(row.candidateId)}>
                              Open profile
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
