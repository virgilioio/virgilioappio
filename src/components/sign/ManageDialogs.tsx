import { useEffect, useState } from 'react'
import { Ban, Lock } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormSheet } from '@/components/references/FormSheet'
import { FormSection } from '@/components/references/FormSection'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { okEmail } from '@/lib/sign/templates'
import { signActions, signErrorMessage, type EnvelopeRow } from '@/lib/sign/api'

/**
 * Void, with a reason. Laid out like the destructive dialogs (§18): tint
 * badge, title naming the thing, what happens, Cancel first, red verb + object.
 * It waits for the server and shows errors inside.
 */
export function VoidDialog({ envelope, open, onOpenChange }: { envelope: EnvelopeRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])
  if (!envelope) return null
  const people = envelope.recipients.filter((r) => r.role !== 'cc' && r.status !== 'waiting').length

  const submit = async () => {
    if (reason.trim().length < 3 || busy) return
    setBusy(true)
    setError(null)
    try {
      await signActions.void(envelope.id, reason.trim())
      await qc.invalidateQueries({ queryKey: ['sign'] })
      onOpenChange(false)
      toast.success(`${envelope.title} voided`, { description: 'Its links no longer open, and everyone who had one was told why.' })
    } catch (e) {
      setError(signErrorMessage(e, 'Couldn’t void it. Nothing changed; try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="z-[90] w-[calc(100vw-24px)] max-w-[420px] rounded-2xl p-0" onEscapeKeyDown={(e) => busy && e.preventDefault()}>
        <div className="flex items-start gap-3 px-6 pb-2 pt-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDECEE] text-[#C2372B]">
            <Ban className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="line-clamp-2 font-poppins text-[17px] font-semibold tracking-[-0.02em] text-text-primary">Void {envelope.title}?</DialogTitle>
            <DialogDescription className="mt-1 font-inter text-[13px] leading-normal text-text-secondary">
              Every link stops working and it can’t be signed after this.{' '}
              {people > 0 ? `${people === 1 ? 'The person who has' : `The ${people} people who have`} a link get an email with your reason.` : 'No one has been emailed yet.'}{' '}
              Anything already signed stays in the audit trail.
            </DialogDescription>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 px-6 pt-2">
          <label htmlFor="void-reason" className="font-inter text-[12.5px] font-medium text-text-primary">
            Reason <span className="text-virgilio-error">*</span>
          </label>
          <Textarea id="void-reason" rows={3} maxLength={500} autoFocus value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong start date; a corrected offer follows" />
          <p className="min-h-[18px] font-inter text-[12px] text-virgilio-error" role={error ? 'alert' : undefined}>
            {error}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#F1F0EC] px-6 py-4">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="dangerSolid" disabled={reason.trim().length < 3} loading={busy} onClick={() => void submit()}>
            Void envelope
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const EXTEND = [
  { value: 'keep', label: 'Keep the current date' },
  { value: '7', label: '7 days from today' },
  { value: '14', label: '14 days from today' },
  { value: '30', label: '30 days from today' },
  { value: '60', label: '60 days from today' },
]

/**
 * Correct who signs: anyone who hasn't signed yet can be renamed or moved to
 * another email, and the expiry can move. Documents and fields don't change.
 */
export function CorrectSheet({ envelope, open, onOpenChange }: { envelope: EnvelopeRow | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [people, setPeople] = useState<Record<string, { name: string; email: string }>>({})
  const [extend, setExtend] = useState('keep')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    if (open && envelope) {
      setPeople(Object.fromEntries(envelope.recipients.map((r) => [r.id, { name: r.name ?? '', email: r.email ?? '' }])))
      setExtend('keep')
      setError(null)
      setAsking(false)
    }
  }, [open, envelope])
  if (!envelope) return null

  const changed = envelope.recipients.filter((r) => {
    const p = people[r.id]
    return p && (p.name.trim() !== (r.name ?? '') || p.email.trim().toLowerCase() !== (r.email ?? ''))
  })
  const dirty = changed.length > 0 || extend !== 'keep'
  const bad = changed.find((r) => !people[r.id].name.trim() || !okEmail(people[r.id].email.trim()))
  const issue = !dirty ? 'Change someone or the expiry' : bad ? `${bad.label ?? bad.name} needs a name and a valid email` : null

  const close = () => {
    if (busy) return
    if (dirty) setAsking(true)
    else onOpenChange(false)
  }
  const submit = async () => {
    if (issue || busy) return
    setBusy(true)
    setError(null)
    try {
      const expires = extend === 'keep' ? null : new Date(Date.now() + Number(extend) * 86_400_000).toISOString()
      await signActions.correct(
        envelope.id,
        changed.map((r) => ({ recipient_id: r.id, name: people[r.id].name.trim(), email: people[r.id].email.trim().toLowerCase() })),
        expires,
      )
      await qc.invalidateQueries({ queryKey: ['sign'] })
      onOpenChange(false)
      toast.success('Envelope corrected', {
        description: changed.length
          ? 'Anyone whose turn it is gets a new link within a minute. Their old link no longer opens.'
          : 'The new expiry applies to every link.',
      })
    } catch (e) {
      setError(signErrorMessage(e, 'Couldn’t save the correction. Nothing changed; try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      width={520}
      eyebrow="Correct envelope"
      title="Correct who signs"
      subtitle={envelope.title}
      footer={
        <div className="relative flex w-full items-center gap-2.5">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <p className={`min-w-0 flex-1 truncate font-inter text-[12px] ${error ? 'text-virgilio-error' : 'text-text-tertiary'}`}>{error ?? issue ?? 'Documents and fields stay as they are.'}</p>
          <Button onClick={() => void submit()} disabled={!!issue} loading={busy}>
            Save correction
          </Button>
          <UnsavedGuard
            open={asking}
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false)
              onOpenChange(false)
            }}
          />
        </div>
      }
    >
      <FormSection title="People" subtitle="Anyone who hasn’t signed can be changed. To change the documents, void this envelope and send a new one.">
        <div className="flex flex-col gap-3">
          {envelope.recipients.map((r, i) => {
            const locked = r.status === 'signed' || r.status === 'approved' || r.status === 'declined'
            const p = people[r.id] ?? { name: '', email: '' }
            return (
              <div key={r.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 font-inter text-[12.5px] font-medium text-text-primary">
                  <span className="w-4 text-center text-[11.5px] tabular-nums text-text-tertiary">{i + 1}</span>
                  <span aria-hidden className="h-3 w-3 rounded" style={{ background: r.color }} />
                  {r.role === 'cc' ? 'Gets a copy' : r.role === 'approver' ? 'Approves' : 'Signs'}
                  {locked && <span className="font-normal text-text-tertiary">· {r.status === 'declined' ? 'Declined' : 'Signed'}</span>}
                </div>
                {locked ? (
                  <p className="ml-6 flex items-center gap-1.5 font-inter text-[12.5px] text-text-secondary">
                    <Lock className="h-3 w-3 text-text-tertiary" strokeWidth={2} aria-hidden />
                    {r.name} · {r.email}
                  </p>
                ) : (
                  <div className="ml-6 grid grid-cols-2 gap-2">
                    <Input
                      aria-label={`Name for person ${i + 1}`}
                      className="h-9"
                      maxLength={120}
                      value={p.name}
                      disabled={busy}
                      onChange={(e) => {
                        const v = e.target.value
                        setPeople((x) => ({ ...x, [r.id]: { ...x[r.id], name: v } }))
                      }}
                    />
                    <Input
                      aria-label={`Email for person ${i + 1}`}
                      className="h-9"
                      type="email"
                      value={p.email}
                      disabled={busy}
                      aria-invalid={!!p.email && !okEmail(p.email.trim())}
                      onChange={(e) => {
                        const v = e.target.value
                        setPeople((x) => ({ ...x, [r.id]: { ...x[r.id], email: v } }))
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </FormSection>
      {envelope.status === 'sent' && (
        <FormSection title="Expiry" subtitle={envelope.expires_at ? `Links currently expire ${new Date(envelope.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : undefined}>
          <Select value={extend} onValueChange={setExtend} disabled={busy}>
            <SelectTrigger className="h-9" aria-label="Expiry">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXTEND.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormSection>
      )}
    </FormSheet>
  )
}
