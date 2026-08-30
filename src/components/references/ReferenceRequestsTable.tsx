import { ChevronRight } from 'lucide-react'

import { RefStatus } from '@/components/references/RefStatus'
import { RefereeTrack } from '@/components/references/RefereeTrack'
import type { ReferenceListRow } from '@/hooks/useReferenceList'

/** ONE grid string — header and every row use it, so columns can never drift. */
const GRID =
  'minmax(0,1.5fr) minmax(0,1.6fr) minmax(0,1.3fr) 200px minmax(0,1.1fr) 40px'

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

export function ReferenceRequestsTable({
  rows,
  onOpen,
}: {
  rows: ReferenceListRow[]
  onOpen: (row: ReferenceListRow) => void
}) {
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
        className="grid"
        style={{
          gridTemplateColumns: GRID,
          gap: 12,
          padding: '10px 18px',
          background: '#FAFAF7',
          borderBottom: '1px solid #E7E8EE',
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

      {rows.map((row, i) => (
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

          <span className="flex justify-end">
            <ChevronRight size={15} color="#B5B9C4" />
          </span>
        </div>
      ))}
    </div>
  )
}

export default ReferenceRequestsTable
