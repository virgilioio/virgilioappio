import { ChevronDown, ExternalLink, Pause, Phone, Send, UserRoundPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AnswerList } from '@/components/references/AnswerRow'
import { resolveAnswers, type ResolvedQuestionAnswer } from '@/lib/references/answers'
import { KeyValueRow } from '@/components/references/KeyValueRow'
import type { RefQuestion } from '@/lib/references/templateModel'
import { RefereeStatus } from '@/components/references/RefereeStatus'
import type { RefereeStatus as RefereeStatusValue } from '@/lib/references/status'

export interface RefereeRowData {
  id: string
  name: string
  email?: string | null
  relationship?: string | null
  title?: string | null
  company?: string | null
  period?: string | null
  status: RefereeStatusValue
  on_hold?: boolean | null
  hold_note?: string | null
  answers?: Record<string, unknown> | null
  submitted_at?: string | null
  opened_at?: string | null
  invited_at?: string | null
  declined_at?: string | null
  source?: string | null
}

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

function fmt(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString(
    undefined,
    { hour: '2-digit', minute: '2-digit' },
  )}`
}

function statusTimestamp(r: RefereeRowData) {
  return fmt(r.submitted_at) ?? fmt(r.declined_at) ?? fmt(r.opened_at) ?? fmt(r.invited_at)
}

/** The score comes from the answer whose QUESTION is a recommendation score. */
function scoreOf(rows: ResolvedQuestionAnswer[]): number | null {
  const hit = rows.find((r) => r.question.type === 'recommendation_score' && r.answer)
  const n = Number(hit?.answer?.value)
  return Number.isFinite(n) ? n : null
}

/**
 * One referee — the single row component for the card and the request detail
 * page. Expansion is controlled by the parent so only one row is open at a time.
 */
export function RefereeRow({
  referee,
  expandable = false,
  expanded = false,
  onToggle,
  questions = [],
  candidateSelf = null,
  showActions = false,
  onRemind,
  onRelease,
  onReplace,
  onLogByPhone,
  onOpenLink,
  busy = false,
}: {
  referee: RefereeRowData
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  /** Questions from the request's FROZEN template snapshot, in template order. */
  questions?: RefQuestion[]
  /** The candidate's self-assessment answers, keyed by question id. */
  candidateSelf?: Record<string, unknown> | null
  showActions?: boolean
  onRemind?: () => void
  onRelease?: () => void
  onReplace?: () => void
  onLogByPhone?: () => void
  onOpenLink?: () => void
  busy?: boolean
}) {
  const held = referee.on_hold === true || referee.status === 'on_hold'
  const bounced = referee.status === 'bounced' || referee.status === 'declined'
  const open = expandable && expanded

  const avatarColor = held ? '#F97316' : bounced ? '#FA5252' : '#6F3FF5'
  const answers =
    referee.answers && typeof referee.answers === 'object'
      ? (referee.answers as Record<string, unknown>)
      : null

  const hasAnswers = referee.status === 'submitted' || referee.status === 'logged'
  const rows = resolveAnswers(questions, answers)
  const score = scoreOf(rows)

  return (
    <div
      style={{
        border: `1px solid ${held ? '#FDE6C8' : open ? '#D7C5FB' : '#F1F0EC'}`,
        borderRadius: 10,
        background: held ? '#FFFBF3' : '#fff',
        transition: 'border-color 160ms ease',
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 11, padding: '11px 13px', cursor: expandable ? 'pointer' : 'default' }}
        onClick={expandable ? onToggle : undefined}
      >
        <span
          className="inline-flex items-center justify-center shrink-0 font-poppins"
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: avatarColor,
            color: '#fffcf9',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {initials(referee.name)}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: 7 }}>
            <span
              className="font-poppins truncate"
              style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: '#1F2230' }}
            >
              {referee.name}
            </span>
            {referee.relationship && (
              <Badge tone="neutral" size="xs">
                {referee.relationship}
              </Badge>
            )}
          </div>
          {(referee.title || referee.company) && (
            <p
              className="font-inter truncate"
              style={{ fontSize: 11, color: '#8B8F9E', marginTop: 2 }}
            >
              {[referee.title, referee.company].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {score !== null && (
          <span
            className="font-poppins shrink-0 tabular-nums"
            style={{
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: score >= 8 ? '#12874F' : '#B45309',
            }}
          >
            {score}
            <span style={{ fontSize: 11, opacity: 0.6 }}>/10</span>
          </span>
        )}

        <RefereeStatus status={held ? 'on_hold' : referee.status} />

        {expandable && (
          <ChevronDown
            size={15}
            color="#B5B9C4"
            style={{
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 160ms ease',
              flexShrink: 0,
            }}
          />
        )}
      </div>

      {open && (
        <div style={{ padding: '0 13px 13px' }}>
          <div
            style={{
              border: '1px solid #D7C5FB',
              background: '#FAF8FF',
              borderRadius: 10,
              padding: '12px 13px',
            }}
          >
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}
            >
              <KeyValueRow label="Email" value={referee.email} />
              <KeyValueRow label="Worked together" value={referee.period} />
              <KeyValueRow
                label="Status"
                value={[
                  held ? 'On hold' : referee.status.replace(/_/g, ' '),
                  statusTimestamp(referee),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </div>

            {held && referee.hold_note && (
              <div
                className="flex"
                style={{
                  gap: 8,
                  marginTop: 12,
                  padding: '10px 11px',
                  background: '#FFFBF3',
                  border: '1px solid #FDE6C8',
                  borderRadius: 8,
                }}
              >
                <Pause size={13} color="#9A3412" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p
                    className="font-inter"
                    style={{ fontSize: 11.5, color: '#9A3412', lineHeight: 1.55 }}
                  >
                    “{referee.hold_note}”
                  </p>
                  <p className="font-inter" style={{ fontSize: 10.5, color: '#B45309', marginTop: 3 }}>
                    Note from the candidate — nobody has been contacted.
                  </p>
                </div>
              </div>
            )}

            {hasAnswers && questions.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <AnswerList
                  questions={questions}
                  answers={answers}
                  candidateSelf={candidateSelf}
                />
              </div>
            )}
          </div>

          {showActions && (
            <div className="flex items-center" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {held && onRelease ? (
                <Button variant="primary" size="sm" icon={Send} loading={busy} onClick={onRelease}>
                  Release &amp; send
                </Button>
              ) : bounced && onReplace ? (
                <Button variant="primary" size="sm" icon={UserRoundPlus} onClick={onReplace}>
                  Request a replacement
                </Button>
              ) : (
                onRemind && (
                  <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onRemind}>
                    Resend email
                  </Button>
                )
              )}
              {onLogByPhone && (
                <Button variant="ghost" size="sm" icon={Phone} onClick={onLogByPhone}>
                  Log by phone instead
                </Button>
              )}
              {onOpenLink && (
                <Button variant="ghost" size="sm" icon={ExternalLink} onClick={onOpenLink}>
                  Open referee link
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RefereeRow
