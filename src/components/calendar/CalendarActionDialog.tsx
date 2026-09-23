import { useEffect, useMemo, useState } from 'react'
import { addDays, addMinutes, format, isBefore, startOfDay } from 'date-fns'
import { AlertTriangle, CalendarClock, RefreshCw, Send, Trash2, CheckCircle2 } from 'lucide-react'

export type CalendarActionMode = 'move' | 'reschedule' | 'rebook' | 'resend' | 'confirm' | 'cancel'

export interface CalendarActionPerson {
  name: string
  email: string | null
}

export interface CalendarActionPayload {
  newStart?: Date
  newEnd?: Date
  notifyCandidate: boolean
  notifyInterviewers: boolean
  message?: string
  reason?: string
  requeue?: boolean
}

interface Props {
  open: boolean
  mode: CalendarActionMode
  eventTitle: string
  jobTitle?: string | null
  start: Date
  end: Date
  /** Slot proposed by a drag, for mode="move". */
  proposedStart?: Date | null
  proposedEnd?: Date | null
  isHold?: boolean
  isDebrief?: boolean
  candidate?: CalendarActionPerson | null
  interviewers?: CalendarActionPerson[]
  /** Non-blocking amber notice, e.g. "Overlaps HM interview · Diego Luna (11:00–12:00)." */
  overlapNotice?: string | null
  submitting?: boolean
  onCancel: () => void
  onConfirm: (payload: CalendarActionPayload) => void
}

const CANCEL_REASONS = [
  'Candidate withdrew',
  'Interviewer unavailable',
  'Will reschedule later',
  'Job on hold or filled',
  'Other',
]

const T = {
  border: '#E7E8EE',
  hairline: '#F1F0EC',
  strip: '#F6F5F1',
  ink: '#0d0d09',
  ink2: '#1F2230',
  muted: '#5A6072',
  tertiary: '#8B8F9E',
  purple: '#6F3FF5',
  purpleTint: '#F3EEFF',
  red: '#E03131',
  redTint: '#FFF1F1',
  amber: '#92400E',
  amberTint: '#FEF3C7',
}

function slotOptions() {
  const out: { value: string; label: string }[] = []
  for (let h = 8; h <= 17; h++) {
    for (const m of [0, 15, 30, 45]) {
      const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      out.push({ value, label: value })
    }
  }
  return out
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
  interviewers = [],
  overlapNotice,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))
  const isTimeMode = mode === 'move' || mode === 'reschedule' || mode === 'rebook'

  const [day, setDay] = useState(() => format(proposedStart ?? start, 'yyyy-MM-dd'))
  const [time, setTime] = useState(() => format(proposedStart ?? start, 'HH:mm'))
  const [notifyCandidate, setNotifyCandidate] = useState(true)
  const [notifyInterviewers, setNotifyInterviewers] = useState(true)
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState(CANCEL_REASONS[0])
  const [requeue, setRequeue] = useState(true)

  useEffect(() => {
    if (!open) return
    setDay(format(proposedStart ?? start, 'yyyy-MM-dd'))
    setTime(format(proposedStart ?? start, 'HH:mm'))
    setNotifyCandidate(!(mode === 'cancel' && isDebrief) && !!candidate)
    setNotifyInterviewers(true)
    setMessage('')
    setReason(CANCEL_REASONS[0])
    setRequeue(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, start.getTime(), proposedStart?.getTime()])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  const newStart = useMemo(() => {
    if (mode === 'move' && proposedStart) return proposedStart
    const [h, m] = time.split(':').map(Number)
    const d = new Date(`${day}T00:00:00`)
    d.setHours(h, m, 0, 0)
    return d
  }, [mode, proposedStart, day, time])

  const newEnd = useMemo(
    () => (mode === 'move' && proposedEnd ? proposedEnd : addMinutes(newStart, durationMin)),
    [mode, proposedEnd, newStart, durationMin],
  )

  const dayChoices = useMemo(() => {
    const today = startOfDay(new Date())
    return Array.from({ length: 45 }, (_, i) => addDays(today, i))
  }, [])

  if (!open) return null

  const inPast = isTimeMode && isBefore(newStart, new Date())
  const unchanged = isTimeMode && newStart.getTime() === start.getTime()
  const noRecipients = !notifyCandidate && !notifyInterviewers
  const danger = mode === 'cancel'

  const heading =
    mode === 'move'
      ? 'Move interview'
      : mode === 'reschedule'
      ? 'Reschedule'
      : mode === 'rebook'
      ? 'Rebook'
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

  const Icon = danger
    ? Trash2
    : mode === 'resend'
    ? Send
    : mode === 'confirm'
    ? CheckCircle2
    : CalendarClock

  const recipientsLabel =
    mode === 'cancel'
      ? 'Send cancellation to'
      : mode === 'resend' || mode === 'confirm'
      ? 'Resend to'
      : 'Send updated invite to'

  let primaryLabel: string
  if (mode === 'move') primaryLabel = noRecipients ? 'Move without notifying' : 'Move & send update'
  else if (mode === 'reschedule' || mode === 'rebook')
    primaryLabel = noRecipients ? 'Reschedule without notifying' : 'Reschedule & send update'
  else if (mode === 'resend') primaryLabel = 'Resend'
  else if (mode === 'confirm') primaryLabel = 'Confirm & send invite'
  else primaryLabel = isHold ? 'Release hold' : isDebrief ? 'Cancel debrief' : 'Cancel interview'

  const secondaryLabel =
    mode === 'move'
      ? 'Undo move'
      : mode === 'cancel'
      ? isHold
        ? 'Keep hold'
        : isDebrief
        ? 'Keep debrief'
        : 'Keep interview'
      : 'Cancel'

  const primaryDisabled =
    submitting ||
    (isTimeMode && (inPast || unchanged)) ||
    (mode === 'resend' && noRecipients)

  const strip = (children: React.ReactNode) => (
    <div className="font-inter" style={{ background: T.strip, borderRadius: 10, padding: '10px 12px' }}>
      {children}
    </div>
  )

  const checkboxCard = (
    key: string,
    label: string,
    sub: string,
    checked: boolean,
    onChange: (v: boolean) => void,
  ) => (
    <label
      key={key}
      className="flex cursor-pointer items-start gap-2.5"
      style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 11px' }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-[2px] h-3.5 w-3.5 accent-[#0d0d09]"
      />
      <span className="min-w-0">
        <span
          className="block font-inter truncate"
          style={{ fontSize: 12, fontWeight: 600, color: T.ink2 }}
        >
          {label}
        </span>
        <span className="block font-inter truncate" style={{ fontSize: 11, color: T.tertiary }}>
          {sub}
        </span>
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(13,13,9,0.32)' }} onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="relative bg-white"
        style={{
          width: 460,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          borderRadius: 16,
          boxShadow: '0 30px 70px -24px rgba(13,13,9,0.45)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5">
          <span
            className="grid flex-shrink-0 place-items-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: danger ? T.redTint : T.purpleTint,
              color: danger ? T.red : T.purple,
            }}
          >
            <Icon size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div
              className="font-poppins"
              style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: T.ink }}
            >
              {heading}
            </div>
            <div className="font-inter truncate" style={{ fontSize: 11.5, color: T.tertiary }}>
              {eventTitle}
              {jobTitle ? ` · ${jobTitle}` : ''}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          {mode === 'move' &&
            strip(
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div style={{ fontSize: 10.5, color: T.tertiary, fontWeight: 600 }}>FROM</div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: T.muted,
                      textDecoration: 'line-through',
                      marginTop: 2,
                    }}
                  >
                    {format(start, 'EEE MMM d')} · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                  </div>
                </div>
                <div className="text-right">
                  <div style={{ fontSize: 10.5, color: T.purple, fontWeight: 700 }}>TO</div>
                  <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 700, marginTop: 2 }}>
                    {format(newStart, 'EEE MMM d')} · {format(newStart, 'HH:mm')}–
                    {format(newEnd, 'HH:mm')}
                  </div>
                </div>
              </div>,
            )}

          {(mode === 'reschedule' || mode === 'rebook') && (
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="block">
                <span
                  className="mb-1 block font-inter"
                  style={{ fontSize: 10.5, fontWeight: 600, color: T.tertiary }}
                >
                  DAY
                </span>
                <select
                  value={day}
                  onChange={e => setDay(e.target.value)}
                  className="w-full font-inter"
                  style={{ height: 34, borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 12.5, padding: '0 8px' }}
                >
                  {dayChoices.map(d => (
                    <option key={d.toISOString()} value={format(d, 'yyyy-MM-dd')}>
                      {format(d, 'EEE MMM d')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span
                  className="mb-1 block font-inter"
                  style={{ fontSize: 10.5, fontWeight: 600, color: T.tertiary }}
                >
                  START
                </span>
                <select
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full font-inter"
                  style={{ height: 34, borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 12.5, padding: '0 8px' }}
                >
                  {slotOptions().map(s => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="col-span-2 font-inter" style={{ fontSize: 11.5, color: T.muted }}>
                Ends {format(newEnd, 'HH:mm')} · {durationMin} min
              </div>
            </div>
          )}

          {(mode === 'resend' || mode === 'confirm') &&
            strip(
              <div style={{ fontSize: 12.5, color: T.ink2, fontWeight: 600 }}>
                {format(start, 'EEE MMM d')} · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
              </div>,
            )}

          {mode === 'cancel' && (
            <div className="space-y-2">
              <label className="block">
                <span
                  className="mb-1 block font-inter"
                  style={{ fontSize: 10.5, fontWeight: 600, color: T.tertiary }}
                >
                  REASON
                </span>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full font-inter"
                  style={{ height: 34, borderRadius: 9, border: `1px solid ${T.border}`, fontSize: 12.5, padding: '0 8px' }}
                >
                  {CANCEL_REASONS.map(r => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              {candidate && !isDebrief && (
                <label className="flex cursor-pointer items-center gap-2 font-inter" style={{ fontSize: 12, color: T.ink2 }}>
                  <input
                    type="checkbox"
                    checked={requeue}
                    onChange={e => setRequeue(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#0d0d09]"
                  />
                  Return candidate to Needs scheduling
                </label>
              )}
            </div>
          )}

          {isTimeMode && inPast && (
            <div
              className="flex items-start gap-2 font-inter"
              style={{ background: T.redTint, color: T.red, borderRadius: 9, fontSize: 11.5, padding: '8px 10px' }}
            >
              <AlertTriangle size={13} strokeWidth={2} className="mt-[1px] flex-shrink-0" />
              That time is in the past. Pick a later slot.
            </div>
          )}

          {isTimeMode && !inPast && overlapNotice && (
            <div
              className="flex items-start gap-2 font-inter"
              style={{ background: T.amberTint, color: T.amber, borderRadius: 9, fontSize: 11.5, padding: '8px 10px' }}
            >
              <AlertTriangle size={13} strokeWidth={2} className="mt-[1px] flex-shrink-0" />
              {overlapNotice}
            </div>
          )}

          {/* Recipients */}
          <div className="space-y-2">
            <div className="font-inter" style={{ fontSize: 10.5, fontWeight: 600, color: T.tertiary }}>
              {recipientsLabel.toUpperCase()}
            </div>
            {candidate &&
              checkboxCard(
                'cand',
                `Candidate · ${candidate.name}`,
                candidate.email || 'No email on file',
                notifyCandidate,
                setNotifyCandidate,
              )}
            {interviewers.length > 0 &&
              checkboxCard(
                'ints',
                `Interviewer${interviewers.length > 1 ? 's' : ''} · ${interviewers
                  .map(i => i.name)
                  .join(', ')}`,
                interviewers.map(i => i.email).filter(Boolean).join(', ') || 'No email on file',
                notifyInterviewers,
                setNotifyInterviewers,
              )}
            {!noRecipients && (
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Add a message (optional)"
                rows={3}
                className="w-full font-inter"
                style={{
                  borderRadius: 10,
                  border: `1px solid ${T.border}`,
                  fontSize: 12.5,
                  padding: '8px 10px',
                  resize: 'vertical',
                }}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3"
          style={{ background: '#FAFAF7', borderTop: `1px solid ${T.hairline}` }}
        >
          <div className="flex items-center gap-1.5 font-inter" style={{ fontSize: 10.5, color: T.tertiary }}>
            <RefreshCw size={12} strokeWidth={2} />
            Updates Google Calendar for everyone on the event
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="font-poppins"
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 9,
                border: `1px solid ${T.border}`,
                background: '#fff',
                fontSize: 12.5,
                fontWeight: 500,
                color: T.ink,
              }}
            >
              {secondaryLabel}
            </button>
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={() =>
                onConfirm({
                  newStart: isTimeMode ? newStart : undefined,
                  newEnd: isTimeMode ? newEnd : undefined,
                  notifyCandidate,
                  notifyInterviewers,
                  message: message.trim() || undefined,
                  reason: mode === 'cancel' ? reason : undefined,
                  requeue: mode === 'cancel' ? requeue : undefined,
                })
              }
              className="font-poppins"
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 9,
                background: danger ? T.red : T.ink,
                color: '#fffcf9',
                fontSize: 12.5,
                fontWeight: 600,
                opacity: primaryDisabled ? 0.5 : 1,
              }}
            >
              {submitting ? 'Working…' : primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
