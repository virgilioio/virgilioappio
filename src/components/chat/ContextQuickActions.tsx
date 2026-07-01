import { useNavigate } from 'react-router-dom'
import { CalendarClock, ArrowRightLeft, StickyNote, ChevronRight } from 'lucide-react'

interface ContextQuickActionsProps {
  jobId: string | null
  candidateId: string | null
  threadId?: string | null
}

interface QuickActionDef {
  key: string
  label: string
  icon: typeof CalendarClock
  hash?: string
  action?: 'open-booking-picker'
}

const ACTIONS: QuickActionDef[] = [
  { key: 'schedule', label: 'Schedule interview', icon: CalendarClock, action: 'open-booking-picker' },
  { key: 'move', label: 'Move stage', icon: ArrowRightLeft, hash: '#move-stage' },
  { key: 'note', label: 'Add note', icon: StickyNote, hash: '#notes' },
]

/**
 * ContextQuickActions — white card with three action rows.
 */
export function ContextQuickActions({ jobId, candidateId, threadId }: ContextQuickActionsProps) {
  const navigate = useNavigate()
  const disabled = !jobId || !candidateId
  const base = jobId && candidateId ? `/jobs/${jobId}/candidates/${candidateId}` : ''

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: 12,
      }}
    >
      <h4
        className="font-poppins"
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: '#0d0d09',
          padding: '2px 4px 9px',
          margin: 0,
        }}
      >
        Quick actions
      </h4>
      <div className="flex flex-col">
        {ACTIONS.map(({ key, label, icon: Icon, hash }) => (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && navigate(`${base}${hash}`)}
            className="flex items-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              padding: '9px 10px',
              borderRadius: 9,
              gap: 10,
              background: 'transparent',
              border: 0,
              width: '100%',
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.background = '#F6F5F1'
            }}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span
              className="flex items-center justify-center shrink-0"
              style={{
                height: 28,
                width: 28,
                borderRadius: 8,
                background: '#F6F5F1',
                color: '#6F3FF5',
              }}
            >
              <Icon style={{ height: 15, width: 15 }} strokeWidth={2} />
            </span>
            <span
              className="flex-1 font-inter text-left"
              style={{ fontSize: 13, fontWeight: 500, color: '#1F2230' }}
            >
              {label}
            </span>
            <ChevronRight
              style={{ height: 15, width: 15, color: '#8B8F9E' }}
              strokeWidth={2}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
