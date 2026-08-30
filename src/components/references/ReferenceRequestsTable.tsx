import {
  ArrowUpRight,
  Ban,
  ChevronRight,
  EllipsisVertical,
  Send,
  Share2,
  Trash2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { RefStatus } from '@/components/references/RefStatus'
import { RefereeTrack } from '@/components/references/RefereeTrack'
import type { ReferenceListRow } from '@/hooks/useReferenceList'
import { isActiveRefState } from '@/lib/references/status'

/** ONE grid string — header and every row use it, so columns can never drift. */
const GRID =
  'minmax(0,1.5fr) minmax(0,1.6fr) minmax(0,1.3fr) 200px minmax(0,1.1fr) 68px'

const HEADS = ['Candidate', 'Collected for', 'Template', 'Progress', 'Last activity', '']

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function shortDate(iso?: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  danger,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  danger?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const color = disabled ? '#B5B9C4' : danger ? '#B42318' : '#1F2230'
  const iconColor = disabled ? '#D1D0CB' : danger ? '#B42318' : '#8B8F9E'

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="font-inter flex items-start w-full"
      style={{
        gap: 9,
        padding: '8px 9px',
        borderRadius: 7,
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        fontSize: 12.5,
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.background = danger ? '#FEF2F2' : '#FAFAF7'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <Icon size={14} color={iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {hint && (
          <span
            className="block"
            style={{ fontSize: 10.5, color: '#8B8F9E', marginTop: 1, lineHeight: 1.4 }}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

export interface ReferenceRequestsTableProps {
  rows: ReferenceListRow[]
  onOpen: (row: ReferenceListRow) => void
  /** Controlled so the page container can close the menu on any outside click. */
  menuFor: string | null
  onMenuChange: (id: string | null) => void
  onResend: (row: ReferenceListRow) => void
  onShare: (row: ReferenceListRow) => void
  onCancel: (row: ReferenceListRow) => void
  onDelete: (row: ReferenceListRow) => void
  canCancel?: boolean
  canDelete?: boolean
}

export function ReferenceRequestsTable({
  rows,
  onOpen,
  menuFor,
  onMenuChange,
  onResend,
  onShare,
  onCancel,
  onDelete,
  canCancel = true,
  canDelete = true,
}: ReferenceRequestsTableProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: GRID,
          gap: 12,
          padding: '10px 18px',
          background: '#FAFAF7',
          borderBottom: '1px solid #E7E8EE',
          borderRadius: '12px 12px 0 0',
        }}
      >
        {HEADS.map((h, i) => (
          <span
            key={i}
            className="font-inter uppercase truncate"
            style={{ fontSize: 10.5, fontWeight: 600, color: '#8B8F9E', letterSpacing: '0.06em' }}
          >
            {h}
          </span>
        ))}
      </div>

      {rows.map((row, i) => {
        const active = isActiveRefState(row.state)
        const cancelled = row.state === 'cancelled'
        const open = menuFor === row.id
        const submitted = row.referees.filter(
          (r) => r.status === 'submitted' || r.status === 'logged',
        ).length

        return (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(row)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(row)
              }
            }}
            className="grid items-center"
            style={{
              gridTemplateColumns: GRID,
              gap: 12,
              padding: '13px 18px',
              cursor: 'pointer',
              background: '#fff',
              opacity: cancelled ? 0.62 : 1,
              borderBottom: i === rows.length - 1 ? undefined : '1px solid #F1F0EC',
            }}
          >
            {/* Candidate */}
            <div className="flex items-center min-w-0" style={{ gap: 9 }}>
              <span
                className="inline-flex items-center justify-center shrink-0 font-poppins"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: '#EDE4FF',
                  color: '#5B21B6',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {initials(row.candidateName)}
              </span>
              <div className="min-w-0">
                <p
                  className="font-poppins truncate"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    color: '#1F2230',
                  }}
                >
                  {row.candidateName}
                </p>
                {row.candidateRole && (
                  <p className="font-inter truncate" style={{ fontSize: 11, color: '#8B8F9E' }}>
                    {row.candidateRole}
                  </p>
                )}
              </div>
            </div>

            {/* Collected for */}
            <div className="min-w-0">
              <p className="font-inter truncate" style={{ fontSize: 12, color: '#1F2230' }}>
                {row.clientName ?? row.jobTitle ?? 'No client'}
              </p>
              <p className="font-inter truncate" style={{ fontSize: 10.5, color: '#8B8F9E' }}>
                {[row.stage, shortDate(row.created_at)].filter(Boolean).join(' · ')}
              </p>
            </div>

            {/* Template */}
            <span className="font-inter truncate" style={{ fontSize: 11.5, color: '#5A6072' }}>
              {row.templateName ?? '—'}
            </span>

            {/* Progress — counts, never a percentage */}
            <div className="flex flex-col" style={{ gap: 5 }}>
              <RefStatus state={row.state} flagged={row.flagged} size="xs" />
              {row.referees.length > 0 && (
                <div className="flex items-center" style={{ gap: 7 }}>
                  <RefereeTrack referees={row.referees} requiredCount={row.required} width={54} />
                  <span
                    className="font-inter tabular-nums truncate"
                    style={{ fontSize: 10.5, color: '#8B8F9E' }}
                  >
                    {row.counts}
                  </span>
                </div>
              )}
            </div>

            {/* Last activity */}
            <span className="font-inter truncate" style={{ fontSize: 11.5, color: '#5A6072' }}>
              {row.lastActivity
                ? `${row.lastActivity.label} · ${ago(row.lastActivity.at)}`
                : `Requested ${ago(row.created_at)}`}
            </span>

            {/* Row actions + chevron. The wrapper stops propagation so opening
                the menu never opens the request. */}
            <div
              className="flex items-center justify-end"
              style={{ gap: 2, position: 'relative' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Row actions"
                onClick={() => onMenuChange(open ? null : row.id)}
                className="inline-flex items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  border: 'none',
                  background: open ? '#F1F0EC' : 'transparent',
                  color: '#8B8F9E',
                  cursor: 'pointer',
                }}
              >
                <EllipsisVertical size={15} />
              </button>
              <ChevronRight size={15} color="#B5B9C4" />

              {open && (
                <div
                  style={{
                    position: 'absolute',
                    top: 30,
                    right: 0,
                    zIndex: 30,
                    minWidth: 208,
                    padding: 5,
                    background: '#fff',
                    border: '1px solid #E7E8EE',
                    borderRadius: 10,
                    boxShadow:
                      '0 12px 32px -8px rgba(13,13,9,0.18), 0 0 0 1px rgba(13,13,9,0.03)',
                  }}
                >
                  <MenuItem
                    icon={ArrowUpRight}
                    label="Open request"
                    onClick={() => {
                      onMenuChange(null)
                      onOpen(row)
                    }}
                  />
                  <MenuItem
                    icon={Send}
                    label={active ? 'Resend' : 'Request again'}
                    onClick={() => {
                      onMenuChange(null)
                      onResend(row)
                    }}
                  />
                  <MenuItem
                    icon={Share2}
                    label="Share report"
                    disabled={submitted === 0}
                    hint={submitted === 0 ? 'Nothing submitted yet' : undefined}
                    onClick={() => {
                      onMenuChange(null)
                      onShare(row)
                    }}
                  />

                  {((active && canCancel) || canDelete) && (
                    <div style={{ height: 1, background: '#F1F0EC', margin: '5px 0' }} />
                  )}

                  {active && canCancel && (
                    <MenuItem
                      icon={Ban}
                      label="Cancel request"
                      hint="Revokes links, keeps answers"
                      danger
                      onClick={() => {
                        onMenuChange(null)
                        onCancel(row)
                      }}
                    />
                  )}
                  {canDelete && (
                    <MenuItem
                      icon={Trash2}
                      label="Delete permanently"
                      hint={
                        submitted > 0
                          ? `Destroys ${submitted} reference${submitted === 1 ? '' : 's'}`
                          : 'Removes the record'
                      }
                      danger
                      onClick={() => {
                        onMenuChange(null)
                        onDelete(row)
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ReferenceRequestsTable
