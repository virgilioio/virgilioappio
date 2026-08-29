import { type ReactNode } from 'react'
import { ArrowUpRight, ChevronDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { RefGlyph } from '@/components/references/RefGlyph'

/**
 * The ONE shell used by the live reference-check card states (awaiting
 * candidate, awaiting referees, answers). Header row is the collapse toggle;
 * body only renders when open. Never build a second card for a second state.
 */
export function RefCardShell({
  status,
  track,
  summary,
  open,
  onToggle,
  onOpenDetail,
  children,
}: {
  /** <RefStatus size="xs" /> for the derived state. */
  status: ReactNode
  /** <RefereeTrack> or <EmptyRefereeTrack> — always one of the two. */
  track: ReactNode
  summary: string
  open: boolean
  onToggle: () => void
  onOpenDetail?: () => void
  children: ReactNode
}) {
  return (
    <section
      className="bg-white overflow-hidden"
      style={{
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(13,13,9,0.03)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
        className="flex items-center cursor-pointer"
        style={{ gap: 12, padding: '13px 16px' }}
      >
        <span
          className="inline-flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 9, background: '#0d0d09' }}
        >
          <RefGlyph size={18} color="#fffcf9" accent="#D7C5FB" />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center" style={{ gap: 9 }}>
            <span
              className="font-poppins"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: '-0.015em',
                color: '#0d0d09',
              }}
            >
              Reference check
            </span>
            {status}
          </div>
          <div className="flex items-center" style={{ gap: 8, marginTop: 4 }}>
            {track}
            <span
              className="font-inter truncate"
              style={{ fontSize: 11.5, color: '#5A6072', fontVariantNumeric: 'tabular-nums' }}
            >
              {summary}
            </span>
          </div>
        </div>

        {onOpenDetail && (
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowUpRight}
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetail()
            }}
          >
            Open
          </Button>
        )}

        <ChevronDown
          size={16}
          color="#B5B9C4"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 160ms ease',
            flexShrink: 0,
          }}
        />
      </div>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #F1F0EC' }}>{children}</div>
      )}
    </section>
  )
}

/** Key/value row used by the "what was sent" blocks in every live state. */
export function RefDetailRow({
  label,
  value,
  valueColor = '#1F2230',
  last = false,
}: {
  label: string
  value: ReactNode
  valueColor?: string
  last?: boolean
}) {
  return (
    <div
      className="flex items-baseline justify-between"
      style={{
        gap: 14,
        padding: '7px 0',
        borderBottom: last ? 'none' : '1px solid #F6F5F1',
      }}
    >
      <span className="font-inter shrink-0" style={{ fontSize: 11, color: '#8B8F9E' }}>
        {label}
      </span>
      <span
        className="font-inter text-right"
        style={{ fontSize: 12, fontWeight: 500, color: valueColor }}
      >
        {value}
      </span>
    </div>
  )
}

/** Footer action bar — same shell in every live state. */
export function RefCardFooter({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center"
      style={{
        gap: 8,
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid #F1F0EC',
        flexWrap: 'wrap',
      }}
    >
      {children}
    </div>
  )
}

export default RefCardShell
