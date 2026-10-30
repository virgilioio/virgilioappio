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
import { Calendar, Check, Lock, UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

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
  /** Kept mounted so it can leave with the dialog's exit; reset each time it opens. */
  open: boolean
  kind: DecisionKind
  candidateFirstName: string
  recruiterName: string
  workspaceName: string
  onClose: () => void
  /** Resolves true once recorded, or with the message to show in the dialog. */
  onSubmit: (input: { reasons: string[]; note: string }) => Promise<true | string>
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
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className="gio-pressable font-inter"
      style={{
        padding: '7px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        background: selected ? '#0d0d09' : '#fff',
        border: selected ? '1px solid #0d0d09' : '1px solid #E0DDD3',
        color: selected ? '#fffcf9' : '#1F2230',
      }}
    >
      {label}
    </button>
  )
}

export function DecisionDialog({
  open,
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
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Each opening starts clean.
  useEffect(() => {
    if (!open) return
    setReasons([])
    setNote('')
    setError(null)
    setRecorded(false)
  }, [open])

  const toggle = (value: string) => {
    setReasons((current) => {
      if (accept) return current[0] === value ? [] : [value]
      return current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    })
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await onSubmit({ reasons, note: note.trim() })
    setBusy(false)
    if (result === true) setRecorded(true)
    else setError(result)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose() }}>
      <DialogContent
        aria-describedby={undefined}
        closeClassName="hidden"
        className="w-[calc(100vw-32px)] max-w-[520px] gap-0 rounded-2xl border-[#E7E8EE] p-0 sm:rounded-2xl"
        style={{ boxShadow: '0 30px 70px -24px rgba(13,13,9,0.3), 0 2px 8px rgba(13,13,9,0.06)' }}
        // O5 (Block B §16, Form): passing on someone starts on Cancel, like every
        // destructive dialog. Requesting an interview starts on the first chip.
        onOpenAutoFocus={(event) => {
          if (accept) return
          event.preventDefault()
          cancelRef.current?.focus()
        }}
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault() }}
        onInteractOutside={(event) => { if (busy) event.preventDefault() }}
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
            <DialogTitle
              className="font-poppins"
              style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.03em', color: '#1F2230', margin: '14px 0 0' }}
            >
              {accept ? 'Interview requested' : "Thanks — that's recorded"}
            </DialogTitle>
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
            {accept ? (
              <div style={{ padding: '20px 24px 0' }}>
                <DialogTitle
                  className="font-poppins"
                  style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.03em', color: '#1F2230', margin: 0 }}
                >
                  {`Request an interview with ${candidateFirstName}`}
                </DialogTitle>
                <p className="font-inter" style={{ fontSize: 12.5, lineHeight: 1.55, color: '#5A6072', margin: '6px 0 0' }}>
                  {`We will let ${recruiterName} know and they will come back to you with times.`}
                </p>
              </div>
            ) : (
              /* Block B §16 header: tint badge, the title names who, what happens and what stays. */
              <div className="flex items-start gap-[14px]" style={{ padding: '22px 24px 0' }}>
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-danger-tint)] text-[var(--color-danger)]"
                >
                  <UserX className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <DialogTitle
                    className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]"
                    style={{ margin: 0 }}
                  >
                    {`Pass on ${candidateFirstName}?`}
                  </DialogTitle>
                  <p className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]" style={{ marginBottom: 0 }}>
                    {`${recruiterName} is told you\u2019re passing, and you can\u2019t change your answer on this link. Telling us why takes ten seconds and sharpens the next shortlist. Nothing here is shown to ${candidateFirstName}.`}
                  </p>
                </div>
              </div>
            )}

            <div style={{ padding: '18px 24px 0' }}>
              <p style={LABEL}>
                {accept ? 'How soon would you like to meet?' : 'What was the main gap?'}
                <Qualifier>{accept ? 'optional' : 'pick any that apply'}</Qualifier>
              </p>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                {(accept ? TIMING_OPTIONS : GAP_OPTIONS).map((option) => (
                  <Chip
                    key={option}
                    label={option}
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
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                aria-label="Anything to add"
                className="mt-2 min-h-[78px] rounded-[10px] border-[#E0DDD3] bg-[#FBFAF7] px-3 py-2.5 font-inter text-[12.5px] leading-[1.6] text-[#1F2230]"
                placeholder={
                  accept
                    ? `Anything you'd like ${recruiterName} to know before the call — people to include, areas to probe…`
                    : 'Anything that would help us calibrate the next few candidates…'
                }
              />
            </div>

            {/* A reserved line (two on phones, where the message wraps), so an error never moves the buttons (§7). */}
            <p
              role={error ? 'alert' : undefined}
              aria-live="polite"
              className="min-h-[46px] font-inter sm:min-h-[28px]"
              style={{ padding: '10px 24px 0', margin: 0, fontSize: 11.5, lineHeight: '18px', color: '#B42318' }}
            >
              {error}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '8px 24px 20px' }}>
              <span
                className="font-inter"
                style={{ flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8B8F9E' }}
              >
                <Lock size={11} />
                Shared with {workspaceName} only
              </span>
              <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
              <Button ref={cancelRef} variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
              {accept ? (
                <Button variant="primary" size="sm" icon={Calendar} loading={busy} onClick={() => void submit()}>
                  Request interview
                </Button>
              ) : (
                <Button variant="dangerSolid" size="sm" loading={busy} onClick={() => void submit()}>
                  {`Pass on ${candidateFirstName}`}
                </Button>
              )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
