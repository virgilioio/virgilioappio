/**
 * Calendar action dialog — move · reschedule · rebook · resend · confirm · cancel.
 * Pixel spec: 460px panel, radius 16, no border, overlay scoped to the page area.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Check,
  CircleAlert,
  RefreshCw,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react'
import { addDays, format, isSameDay, isWeekend, startOfDay } from 'date-fns'

export type CalendarActionMode = 'move' | 'reschedule' | 'rebook' | 'resend' | 'confirm' | 'cancel'

export interface CalendarActionPayload {
  newStart?: Date
  newEnd?: Date
  notifyCandidate: boolean
  notifyInterviewers: boolean
  message?: string
  reason?: string
  requeue?: boolean
}

const T = {
  ink: '#0d0d09',
  text: '#1F2230',
  text2: '#5A6072',
  muted: '#8B8F9E',
  hairline: '#E7E8EE',
  divider: '#F1F0EC',
  surface2: '#F6F5F1',
  footerBg: '#FAFAF7',
  purple: '#6F3FF5',
  purpleTint: '#F3EEFF',
  selBorder: '#D7C5FB',
  selBg: '#FBFAFF',
  danger: '#E03131',
  dangerTint: '#FFF1F1',
  amberBg: '#FEF3C7',
  amberFg: '#92400E',
  redFg: '#C92A2A',
} as const

const INTER = 'Inter, sans-serif'
const POPPINS = 'Poppins, sans-serif'

const selectStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: `1px solid ${T.hairline}`,
  background: '#fff',
  padding: '0 10px',
  fontFamily: INTER,
  fontWeight: 400,
  fontSize: 12.5,
  color: T.text,
  width: '100%',
}

const fieldLabel: React.CSSProperties = {
  fontFamily: INTER,
  fontWeight: 600,
  fontSize: 11,
  color: T.text2,
  marginBottom: 6,
  display: 'block',
}

const hhmm = (d: Date) => format(d, 'H:mm')
const slotText = (s: Date, e: Date) => `${format(s, 'EEE MMM d')} · ${hhmm(s)}–${hhmm(e)}`

const CANCEL_REASONS = [
  'Candidate withdrew',
  'Interviewer unavailable',
  'Will reschedule later',
  'Job on hold or filled',
  'Other',
]

function SmallButton({
  variant,
  label,
  disabled,
  onClick,
}: {
  variant: 'primary' | 'secondary' | 'danger'
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  const skin =
    variant === 'primary'
      ? { background: T.ink, color: '#fffcf9', border: '1px solid transparent', boxShadow: '0 1px 2px rgba(13,13,9,0.08)' }
      : variant === 'danger'
      ? { background: '#fff', color: '#FA5252', border: '1px solid #FECACA' }
      : { background: '#fff', color: T.text, border: '1px solid #E0DDD3' }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 28,
        padding: '0 10px',
        borderRadius: 8,
        fontFamily: POPPINS,
        fontWeight: 500,
        fontSize: 12,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        ...skin,
      }}
    >
      {label}
    </button>
  )
}

function CheckboxCard({
  checked,
  onChange,
  title,
  sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: string
  sub?: string | null
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '9px 11px',
        borderRadius: 9,
        cursor: 'pointer',
        border: `1px solid ${checked ? T.selBorder : T.hairline}`,
        background: checked ? T.selBg : '#fff',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
      />
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          marginTop: 1,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          border: checked ? `1.5px solid ${T.purple}` : '1.5px solid #C2C6D2',
          background: checked ? T.purple : '#fff',
        }}
      >
        {checked && <Check size={11} strokeWidth={3} color="#fff" />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{ display: 'block', fontFamily: INTER, fontWeight: 600, fontSize: 12.5, color: T.text }}
        >
          {title}
        </span>
        {sub && (
          <span
            style={{
              display: 'block',
              fontFamily: INTER,
              fontWeight: 400,
              fontSize: 11,
              color: T.muted,
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {sub}
          </span>
        )}
      </span>
    </label>
  )
}

export function CalendarActionDialog({
  open,
  mode,
  eventTitle,
  jobTitle,
  start,
  end,
  proposedStart,
  proposedEnd,
  isHold,
  isDebrief,
  candidate,
  interviewers,
  overlapNotice,
  submitting,
  weekDays,
  onCancel,
  onConfirm,
}: {
  open: boolean
  mode: CalendarActionMode
  eventTitle: string
  jobTitle: string | null
  start: Date
  end: Date
  proposedStart?: Date
  proposedEnd?: Date
  isHold?: boolean
  isDebrief?: boolean
  candidate: { name: string; email: string | null } | null
  interviewers: { name: string; email: string | null }[]
  overlapNotice?: string | null
  submitting?: boolean
  weekDays?: Date[]
  onCancel: () => void
  onConfirm: (payload: CalendarActionPayload) => void
}) {
  const isMove = mode === 'move'
  const isReschedule = mode === 'reschedule' || mode === 'rebook'
  const isCancel = mode === 'cancel'
  const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))

  const days = useMemo(() => {
    if (weekDays?.length) return weekDays
    const today = startOfDay(new Date())
    const windowDays = Array.from({ length: 29 }, (_, i) => addDays(today, i)).filter(d => !isWeekend(d))
    const eventDay = startOfDay(start)
    const inWindow = windowDays.some(d => isSameDay(d, eventDay))
    return inWindow ? windowDays : [eventDay, ...windowDays]
  }, [weekDays, start])

  const todayStart = startOfDay(new Date())

  const [dayIdx, setDayIdx] = useState(() => {
    const i = days.findIndex(d => isSameDay(d, start))
    return i >= 0 ? i : 0
  })
  const [startMin, setStartMin] = useState(() => start.getHours() * 60 + start.getMinutes())
  const [notifyCandidate, setNotifyCandidate] = useState(!(isCancel && isDebrief))
  const [notifyInterviewers, setNotifyInterviewers] = useState(true)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [requeue, setRequeue] = useState(true)
  const primaryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const btn = primaryRef.current?.querySelector('button:last-of-type') as HTMLButtonElement | null
    btn?.focus()
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  if (!open) return null

  const newStart = isMove
    ? proposedStart ?? start
    : isReschedule
    ? (() => {
        const d = startOfDay(days[dayIdx] ?? start)
        return new Date(d.getTime() + startMin * 60000)
      })()
    : start
  const newEnd = isMove ? proposedEnd ?? end : new Date(newStart.getTime() + durationMin * 60000)

  const inPast = (isMove || isReschedule) && newStart.getTime() < Date.now()
  const unchanged = (isMove || isReschedule) && newStart.getTime() === start.getTime()

  const showCandidateCard = !!candidate
  const showInterviewerCard = interviewers.length > 0
  const anyChecked =
    (showCandidateCard && notifyCandidate) || (showInterviewerCard && notifyInterviewers)

  const title = isMove
    ? isHold
      ? 'Move hold?'
      : isDebrief
      ? 'Move debrief?'
      : 'Move interview?'
    : isReschedule
    ? isHold
      ? 'Reschedule hold'
      : isDebrief
      ? 'Reschedule debrief'
      : 'Reschedule interview'
    : mode === 'resend'
    ? isHold
      ? 'Resend slot options'
      : 'Resend invite'
    : mode === 'confirm'
    ? 'Confirm slot'
    : isHold
    ? 'Release hold'
    : isDebrief
    ? 'Cancel debrief'
    : 'Cancel interview'

  const TileIcon = isCancel
    ? CalendarX
    : mode === 'resend'
    ? Send
    : mode === 'confirm'
    ? CalendarCheck
    : CalendarClock

  const recipientLabel =
    mode === 'resend' ? 'Resend to' : isCancel ? 'Send cancellation to' : 'Send updated invite to'

  const secondaryLabel = isMove
    ? 'Undo move'
    : isCancel
    ? isHold
      ? 'Keep hold'
      : isDebrief
      ? 'Keep debrief'
      : 'Keep interview'
    : 'Cancel'

  const primaryLabel = isMove
    ? anyChecked
      ? 'Move & send update'
      : 'Move without notifying'
    : isReschedule
    ? anyChecked
      ? 'Reschedule & send update'
      : 'Reschedule without notifying'
    : mode === 'resend'
    ? 'Resend'
    : mode === 'confirm'
    ? anyChecked
      ? 'Confirm & send invite'
      : 'Confirm without notifying'
    : isHold
    ? 'Release hold'
    : isDebrief
    ? 'Cancel debrief'
    : 'Cancel interview'

  const primaryDisabled =
    submitting ||
    ((isMove || isReschedule) && (inPast || unchanged)) ||
    (mode === 'resend' && !anyChecked)

  const interviewerNames = interviewers.map(i => i.name).join(', ')
  const interviewerEmails = interviewers.map(i => i.email).filter(Boolean).join(', ')

  return (
    <div
      onPointerDown={e => {
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(13,13,9,0.32)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: 460,
          maxWidth: '100%',
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 30px 70px -20px rgba(13,13,9,0.45)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 20px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              flexShrink: 0,
              display: 'grid',
              placeItems: 'center',
              background: isCancel ? T.dangerTint : T.purpleTint,
            }}
          >
            <TileIcon size={16} strokeWidth={2} color={isCancel ? T.danger : T.purple} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: POPPINS,
                fontWeight: 600,
                fontSize: 16,
                color: T.ink,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 400,
                fontSize: 12,
                color: T.text2,
                lineHeight: 1.45,
                marginTop: 2,
              }}
            >
              {eventTitle}
              {jobTitle ? ` · ${jobTitle}` : ''}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', lineHeight: 0 }}
          >
            <X size={15} strokeWidth={2.25} color={T.muted} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isMove && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
                alignItems: 'center',
                gap: 10,
                background: T.surface2,
                borderRadius: 10,
                padding: '10px 12px',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: INTER,
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: T.muted,
                  }}
                >
                  From
                </div>
                <div
                  style={{
                    fontFamily: INTER,
                    fontWeight: 400,
                    fontSize: 12.5,
                    color: T.muted,
                    textDecoration: 'line-through',
                    marginTop: 2,
                  }}
                >
                  {slotText(start, end)}
                </div>
              </div>
              <ArrowRight size={14} strokeWidth={2} color={T.muted} />
              <div>
                <div
                  style={{
                    fontFamily: INTER,
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: T.purple,
                  }}
                >
                  To
                </div>
                <div
                  style={{ fontFamily: INTER, fontWeight: 600, fontSize: 12.5, color: T.text, marginTop: 2 }}
                >
                  {slotText(newStart, newEnd)}
                </div>
              </div>
            </div>
          )}

          {isReschedule && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)',
                gap: 10,
              }}
            >
              <div>
                <label style={fieldLabel}>Day</label>
                <select
                  value={dayIdx}
                  onChange={e => setDayIdx(Number(e.target.value))}
                  style={selectStyle}
                >
                  {days.map((d, i) => (
                    <option
                      key={i}
                      value={i}
                      disabled={startOfDay(d).getTime() < todayStart.getTime() || (i === 0 && !days.slice(1).some(day => isSameDay(day, d)) && !weekDays?.length)}
                    >
                      {format(d, 'EEEE, MMM d')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Start</label>
                <select
                  value={startMin}
                  onChange={e => setStartMin(Number(e.target.value))}
                  style={selectStyle}
                >
                  {Array.from({ length: ((17 * 60 + 45) - 8 * 60) / 15 + 1 }, (_, i) => 8 * 60 + i * 15).map(
                    m => (
                      <option key={m} value={m}>
                        {`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Ends</label>
                <div style={{ ...selectStyle, background: T.footerBg, color: T.text2, display: 'flex', alignItems: 'center' }}>
                  {hhmm(newEnd)} · {durationMin} min
                </div>
              </div>
            </div>
          )}

          {(mode === 'resend' || mode === 'confirm') && (
            <div
              style={{
                background: T.surface2,
                borderRadius: 10,
                padding: '10px 12px',
                fontFamily: INTER,
                fontWeight: 400,
                fontSize: 12.5,
                color: T.text,
              }}
            >
              {slotText(start, end)}
            </div>
          )}

          {isCancel && !isHold && (
            <div>
              <label style={fieldLabel}>Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)} style={selectStyle}>
                {CANCEL_REASONS.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(isMove || isReschedule) && inPast && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                background: T.dangerTint,
                color: T.redFg,
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: INTER,
                fontWeight: 400,
                fontSize: 11.5,
              }}
            >
              <CircleAlert size={13} strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
              That time has already passed. Pick a later slot.
            </div>
          )}
          {(isMove || isReschedule) && !inPast && overlapNotice && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                background: T.amberBg,
                color: T.amberFg,
                borderRadius: 8,
                padding: '8px 10px',
                fontFamily: INTER,
                fontWeight: 400,
                fontSize: 11.5,
                lineHeight: 1.45,
              }}
            >
              <TriangleAlert size={13} strokeWidth={2} style={{ marginTop: 1, flexShrink: 0 }} />
              {overlapNotice}
            </div>
          )}

          {(showCandidateCard || showInterviewerCard) && (
            <div>
              <div style={fieldLabel}>{recipientLabel}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {showCandidateCard && (
                  <CheckboxCard
                    checked={notifyCandidate}
                    onChange={setNotifyCandidate}
                    title={`Candidate · ${candidate!.name}`}
                    sub={candidate!.email}
                  />
                )}
                {showInterviewerCard && (
                  <CheckboxCard
                    checked={notifyInterviewers}
                    onChange={setNotifyInterviewers}
                    title={`${interviewers.length > 1 ? 'Interviewers' : 'Interviewer'} · ${interviewerNames}`}
                    sub={interviewerEmails || null}
                  />
                )}
              </div>
            </div>
          )}

          {isCancel && !isHold && candidate && (
            <CheckboxCard
              checked={requeue}
              onChange={setRequeue}
              title="Return candidate to Needs scheduling"
              sub="Keeps them in the stage so they aren't forgotten"
            />
          )}

          {anyChecked && (
            <div>
              <div style={fieldLabel}>
                Message
                <span style={{ fontWeight: 400, color: T.muted }}> · optional, added to the email</span>
              </div>
              <textarea
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  isCancel
                    ? 'Sorry for the late notice…'
                    : 'Something came up on our side, hope this time works.'
                }
                style={{
                  ...selectStyle,
                  height: 'auto',
                  padding: '8px 10px',
                  lineHeight: 1.45,
                  resize: 'vertical',
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${T.divider}`,
            background: T.footerBg,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={12} strokeWidth={2} color={T.muted} />
            <span style={{ fontFamily: INTER, fontWeight: 400, fontSize: 11, color: T.muted }}>
              Updates Google Calendar for everyone on the event
            </span>
          </div>
          <div ref={primaryRef} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SmallButton variant="secondary" label={secondaryLabel} onClick={onCancel} />
            <SmallButton
              variant={isCancel ? 'danger' : 'primary'}
              label={primaryLabel}
              disabled={primaryDisabled}
              onClick={() =>
                onConfirm({
                  newStart: isMove || isReschedule ? newStart : undefined,
                  newEnd: isMove || isReschedule ? newEnd : undefined,
                  notifyCandidate: showCandidateCard ? notifyCandidate : false,
                  notifyInterviewers: showInterviewerCard ? notifyInterviewers : false,
                  message: message.trim() || undefined,
                  reason: isCancel ? reason : undefined,
                  requeue: isCancel && !isHold && candidate ? requeue : undefined,
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
