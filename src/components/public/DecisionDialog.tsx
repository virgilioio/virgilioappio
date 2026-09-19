/**
 * The client's decision, captured at the only moment they will type a reason.
 *
 * Both public buttons open this; nothing is written until the client submits from
 * inside it. Chips carry the reporting dimension, the note carries the nuance, and
 * neither is required — a required field on a busy hiring manager buys you "n/a"
 * or an abandoned decision.
 *
 * Nothing here ever names the person who clicked: the page is an anonymous token
 * link, so the copy stays inside what the auth model can actually support.
 */
import { useEffect, useRef, useState } from 'react'
import { Calendar, Check, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'

export type DecisionKind = 'interview_requested' | 'not_a_fit'

const TIMING_OPTIONS = ['As soon as possible', 'Next week', 'In two weeks or more', 'Flexible']
const GAP_OPTIONS = [
  'Not enough experience',
  'Too senior',
  'Skills gap',
  'Compensation',
  'Location',
  'Timing',
  'Industry background',
  'Other',
]

interface DecisionDialogProps {
  kind: DecisionKind
  candidateFirstName: string
  recruiterName: string
  workspaceName: string
  onClose: () => void
  onSubmit: (input: { reasons: string[]; note: string }) => Promise<boolean>
}

const LABEL: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#8B8F9E',
  margin: 0,
}

function Qualifier({ children }: { children: string }) {
  return (
    <span style={{ textTransform: 'none', letterSpacing: 'normal', fontWeight: 400, color: '#B9B7AC' }}>
      {' '}· {children}
    </span>
  )
}

function Chip({
  label,
  selected,
  onClick,
  autoFocus,
}: {
  label: string
  selected: boolean
  onClick: () => void
  autoFocus?: boolean
}) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      aria-pressed={selected}
      onClick={onClick}
      className="font-inter"
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        background: selected ? '#0d0d09' : '#fff',
        border: selected ? '1px solid #0d0d09' : '1px solid #E0DDD3',
        color: selected ? '#fffcf9' : '#1F2230',
        transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      {label}
    </button>
  )
}

export function DecisionDialog({
  kind,
  candidateFirstName,
  recruiterName,
  workspaceName,
  onClose,
  onSubmit,
}: DecisionDialogProps) {
  const accept = kind === 'interview_requested'
  const [reasons, setReasons] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recorded, setRecorded] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  // Escape closes; Tab stays inside.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return
      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), textarea, [href], input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  const toggle = (value: string) => {
    setReasons((current) => {
      if (accept) return current[0] === value ? [] : [value]
      return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    })
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const ok = await onSubmit({ reasons, note: note.trim() })
    setBusy(false)
    if (ok) setRecorded(true)
    else setError('Your response could not be recorded. Please try again.')
  }

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        background: 'rgba(13,13,9,0.35)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={accept ? 'Request an interview' : 'Not the right fit'}
        style={{
          width: 520,
          maxWidth: '100%',
          background: '#fff',
          border: '1px solid #E7E8EE',
          borderRadius: 16,
          boxShadow: '0 30px 70px -24px rgba(13,13,9,0.3), 0 2px 8px rgba(13,13,9,0.06)',
        }}
      >
        {recorded ? (
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: 13,
                background: accept ? '#D1FAE5' : '#F1F0EC',
                color: accept ? '#065F46' : '#5A6072',
              }}
            >
              <Check size={20} />
            </span>
            <h2
              className="font-poppins"
              style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: '#1F2230', margin: '14px 0 0' }}
            >
              {accept ? 'Interview requested' : "Thanks — that's recorded"}
            </h2>
            <p
              className="font-inter"
              style={{ fontSize: 13, lineHeight: 1.6, color: '#5A6072', margin: '8px auto 0', maxWidth: 360 }}
            >
              {accept
                ? `${recruiterName} has been notified and will be in touch to schedule. You can keep this link — we will update it as things move.`
                : `${recruiterName} has been notified. Your reasons go straight into the brief, so the next candidates we send you are closer to the mark.`}
            </p>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
              <Button variant="secondary" size="sm" onClick={onClose}>Back to the dossier</Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '20px 24px 0' }}>
              <h2
                className="font-poppins"
                style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.03em', color: '#1F2230', margin: 0 }}
              >
                {accept ? `Request an interview with ${candidateFirstName}` : 'Not the right fit'}
              </h2>
              <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5A6072', margin: '6px 0 0' }}>
                {accept
                  ? `We will let ${recruiterName} know and they will come back to you with times.`
                  : 'Telling us why takes ten seconds and makes the next shortlist better. Nothing here is shown to the candidate.'}
              </p>
            </div>

            <div style={{ padding: '18px 24px 0' }}>
              <p style={LABEL}>
                {accept ? 'How soon would you like to meet?' : 'What was the main gap?'}
                <Qualifier>{accept ? 'optional' : 'pick any that apply'}</Qualifier>
              </p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                {(accept ? TIMING_OPTIONS : GAP_OPTIONS).map((option, index) => (
                  <Chip
                    key={option}
                    label={option}
                    autoFocus={index === 0}
                    selected={reasons.includes(option)}
                    onClick={() => toggle(option)}
                  />
                ))}
              </div>
            </div>

            <div style={{ padding: '18px 24px 0' }}>
              <p style={LABEL}>
                Anything to add<Qualifier>optional</Qualifier>
              </p>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                className="font-inter"
                placeholder={
                  accept
                    ? `Anything you'd like ${recruiterName} to know before the call — people to include, areas to probe…`
                    : 'Anything that would help us calibrate the next few candidates…'
                }
                style={{
                  width: '100%',
                  minHeight: 78,
                  marginTop: 8,
                  border: '1px solid #E0DDD3',
                  borderRadius: 10,
                  background: '#FBFAF7',
                  padding: '10px 12px',
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  color: '#1F2230',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="font-inter"
                style={{ padding: '10px 24px 0', margin: 0, fontSize: 11.5, color: '#B42318' }}
              >
                {error}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px 20px' }}>
              <span
                className="font-inter"
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B8F9E' }}
              >
                <Lock size={11} />
                Shared with {workspaceName} only
              </span>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                icon={accept ? Calendar : Check}
                loading={busy}
                onClick={() => void submit()}
              >
                {accept ? 'Request interview' : 'Submit'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
