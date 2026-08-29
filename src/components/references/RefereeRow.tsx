import { useState } from 'react'
import { ChevronDown, ExternalLink, Phone, Send, UserRoundPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefereeStatus } from '@/components/references/RefereeStatus'
import type { RefereeStatus as RefereeStatusValue } from '@/lib/references/status'

export interface RefereeRowData {
  id: string
  name: string
  relationship?: string | null
  title?: string | null
  company?: string | null
  status: RefereeStatusValue
  on_hold?: boolean | null
  hold_note?: string | null
  answers?: Record<string, unknown> | null
}

function initials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/**
 * One referee. Expandable ONLY when there are answers to reveal — in the
 * awaiting-referees state there is nothing behind the chevron, so there is no
 * chevron.
 */
export function RefereeRow({
  referee,
  expandable = false,
  answerLabels = {},
  onRemind,
  onRelease,
  onReplace,
  onLogByPhone,
  onOpenLink,
  busy = false,
}: {
  referee: RefereeRowData
  expandable?: boolean
  /** question id → label, from the frozen snapshot. */
  answerLabels?: Record<string, string>
  onRemind?: () => void
  onRelease?: () => void
  onReplace?: () => void
  onLogByPhone?: () => void
  onOpenLink?: () => void
  busy?: boolean
}) {
  const [open, setOpen] = useState(false)
  const held = referee.on_hold === true || referee.status === 'on_hold'
  const bounced = referee.status === 'bounced' || referee.status === 'declined'

  const avatarColor = held ? '#F97316' : bounced ? '#FA5252' : '#6F3FF5'
  const answers = referee.answers && typeof referee.answers === 'object' ? referee.answers : null
  const answerEntries = answers
    ? Object.entries(answers).filter(([, v]) => v !== null && v !== '' && v !== undefined)
    : []

  return (
    <div
      style={{
        border: `1px solid ${held ? '#FDE6C8' : '#F1F0EC'}`,
        borderRadius: 10,
        background: held ? '#FFFBF3' : '#fff',
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 11, padding: '11px 13px', cursor: expandable ? 'pointer' : 'default' }}
        onClick={expandable ? () => setOpen((v) => !v) : undefined}
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
          {held && referee.hold_note && (
            <p
              className="font-inter"
              style={{ fontSize: 11, color: '#9A3412', marginTop: 4, fontStyle: 'italic' }}
            >
              “{referee.hold_note}”
            </p>
          )}
        </div>

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

      {expandable && open && (
        <div style={{ padding: '0 13px 13px' }}>
          {answerEntries.length > 0 ? (
            <div className="flex flex-col" style={{ gap: 9 }}>
              {answerEntries.map(([key, value]) => (
                <div key={key}>
                  <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E' }}>
                    {answerLabels[key] ?? key}
                  </p>
                  <p
                    className="font-inter"
                    style={{ fontSize: 12, color: '#1F2230', marginTop: 2, lineHeight: 1.55 }}
                  >
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-inter" style={{ fontSize: 11.5, color: '#8B8F9E' }}>
              No answers recorded yet.
            </p>
          )}

          <div className="flex items-center" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {held && onRelease && (
              <Button variant="primary" size="sm" icon={Send} loading={busy} onClick={onRelease}>
                Release &amp; send
              </Button>
            )}
            {!held && bounced && onReplace && (
              <Button variant="primary" size="sm" icon={UserRoundPlus} onClick={onReplace}>
                Request a replacement
              </Button>
            )}
            {!held && !bounced && onRemind && (
              <Button variant="secondary" size="sm" icon={Send} loading={busy} onClick={onRemind}>
                Resend email
              </Button>
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
        </div>
      )}
    </div>
  )
}

export default RefereeRow
