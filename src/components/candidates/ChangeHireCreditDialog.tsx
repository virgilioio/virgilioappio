import { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AlertTriangle, ArrowRight, Check, History, UserCog } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { useChangeHireCredit, type HireCredit } from '@/lib/hireCredit'

type Seat = 'sourcer' | 'recruiter'
const SEAT_LABEL: Record<Seat, string> = { sourcer: 'Sourcer', recruiter: 'Recruiter' }

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

function FieldLabel({ children, hint, id }: { children: React.ReactNode; hint?: React.ReactNode; id?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <span id={id} className="font-poppins text-[12.5px] font-semibold text-[#1F2230]">
        {children}
      </span>
      {hint && <span className="truncate font-inter text-[11px] text-[#8B8F9E]">{hint}</span>}
    </div>
  )
}

/**
 * Change who a hire credits (Allan, 2026-10-23): admins only, in the frame of
 * the ATS's action dialogs (Add or transfer candidate, Reject). The people are
 * the job's Sourcers and Recruiters, as in Mark hired; the change goes to the
 * candidate's activity and to Gio Sales, which keeps an issued invoice's
 * credits and asks Billing to check them.
 */
export function ChangeHireCreditDialog({
  open,
  onOpenChange,
  applicationId,
  jobId,
  candidateFirstName,
  credit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  jobId: string
  candidateFirstName: string
  credit: HireCredit
}) {
  const change = useChangeHireCredit(applicationId)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const { assignments } = useJobAssignments(open ? jobId : undefined)
  const { members } = useMembers(true)
  const [picked, setPicked] = useState<Record<Seat, string | null>>({ sourcer: credit.sourcerId, recruiter: credit.recruiterId })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPicked({ sourcer: credit.sourcerId, recruiter: credit.recruiterId })
      setError(null)
    }
  }, [open, credit.sourcerId, credit.recruiterId])

  const nameOf = useMemo(() => {
    const map = new Map(
      members.map((m) => [m.user_id, `${m.user_first_name || ''} ${m.user_last_name || ''}`.trim() || m.user_email || 'Member']),
    )
    return (id: string | null) => (id ? map.get(id) ?? 'Someone no longer on the team' : 'No one')
  }, [members])

  const pool = (seat: Seat) =>
    assignments
      .filter((a: { role?: string; deleted_at?: string | null }) => a.role === seat && !a.deleted_at)
      .map((a: { user_id: string }) => ({ id: a.user_id, name: nameOf(a.user_id) }))

  const current: Record<Seat, string | null> = { sourcer: credit.sourcerId, recruiter: credit.recruiterId }
  const changed = (['sourcer', 'recruiter'] as Seat[]).filter((s) => picked[s] && picked[s] !== current[s])
  const ready = !!picked.sourcer && !!picked.recruiter && changed.length > 0

  const close = () => {
    if (change.isPending) return
    onOpenChange(false)
  }

  const submit = async () => {
    setError(null)
    if (!ready) return
    try {
      await change.mutateAsync({ openingId: credit.openingId, sourcerId: picked.sourcer!, recruiterId: picked.recruiter! })
      toast(`${credit.reqId}: ${changed.map((s) => `${SEAT_LABEL[s]} is now ${nameOf(picked[s])}`).join(', ')}.`)
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[60]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[70] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          // Cancel has focus first; Esc and the backdrop wait while it saves.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (change.isPending) e.preventDefault()
          }}
          style={{
            width: 520,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#FEF3C7] text-[#B45309]">
              <UserCog className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                Change who&apos;s credited on {candidateFirstName}&apos;s hire
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                {credit.reqId}. The Sourcer and the Recruiter on a hire earn its commissions.
              </DialogPrimitive.Description>
            </div>
          </header>

          <form
            id="change-hire-credit"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={{ padding: 24, gap: 18 }}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            {(['sourcer', 'recruiter'] as Seat[]).map((seat) => {
              const people = pool(seat)
              const label = SEAT_LABEL[seat]
              return (
                <section key={seat}>
                  <FieldLabel id={`credit-${seat}-label`} hint={`${label}s on this job`}>
                    {label}
                  </FieldLabel>
                  {people.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-[10px] border border-dashed border-[#D4D2CA] px-3 py-2.5 font-inter text-[12.5px] text-[#5A6072]">
                      <span className="min-w-0 flex-1">This job has no {label} on its team.</span>
                      <a href={`/jobs/${jobId}/setup#hiring-team`} className="shrink-0 font-medium text-[#1F2230] underline underline-offset-2">
                        Hiring team
                      </a>
                    </div>
                  ) : (
                    <div role="radiogroup" aria-labelledby={`credit-${seat}-label`} className="flex flex-col gap-1">
                      {people.map((p) => {
                        const selected = picked[seat] === p.id
                        const isNow = current[seat] === p.id
                        return (
                          <button
                            key={p.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={change.isPending}
                            onClick={() => setPicked((v) => ({ ...v, [seat]: p.id }))}
                            className="gio-pressable flex items-center gap-3 text-left transition-colors duration-hover"
                            style={{
                              padding: '8px 12px',
                              borderRadius: 10,
                              background: selected ? '#F5EFFF' : '#FFFFFF',
                              border: `1px solid ${selected ? '#DFCBFB' : '#EDECE6'}`,
                              boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
                            }}
                          >
                            <span
                              aria-hidden
                              className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                              style={{ background: selected ? '#6F3FF5' : '#FFFFFF', border: `1px solid ${selected ? '#6F3FF5' : '#D4D2CA'}` }}
                            >
                              {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                            </span>
                            <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#F1F0EC] font-inter text-[10px] font-semibold text-[#5A6072]">
                              {initials(p.name)}
                            </span>
                            <span className={`min-w-0 flex-1 truncate font-poppins text-[13px] font-semibold ${selected ? 'text-[#5B21B6]' : 'text-[#1F2230]'}`}>
                              {p.name}
                            </span>
                            {isNow && <span className="shrink-0 font-inter text-[11.5px] text-[#8B8F9E]">Credited now</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {current[seat] && !people.some((p) => p.id === current[seat]) && (
                    <p className="mt-1.5 font-inter text-[11.5px] text-[#8B8F9E]">
                      Credited now: {nameOf(current[seat])}, who is no longer a {label} on this job.
                    </p>
                  )}
                </section>
              )
            })}

            {changed.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {changed.map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <Pill label={`${SEAT_LABEL[s]} now`} value={nameOf(current[s])} />
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#8B8F9E]" aria-hidden />
                    <Pill label="After" value={nameOf(picked[s])} accent />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2.5 rounded-[10px] border border-[#FCE7B2] bg-[#FFFBEB] px-3 py-2.5" role="note">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B45309]" aria-hidden />
              <p className="font-inter text-[12.5px] leading-[1.5] text-[#7C4A03]">
                The commissions move to the people you choose. If Gio Sales has already issued this hire&apos;s invoice, the invoice
                keeps the people it was issued with and Billing gets a note to check it.
              </p>
            </div>

            {error && (
              <p className="rounded-[10px] border border-[#F3D0CC] bg-[#FEF4F4] px-3 py-2 font-inter text-[12.5px] text-[#B91C1C]" role="alert">
                {error}
              </p>
            )}
          </form>

          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <div className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
              <History className="h-3 w-3 shrink-0 text-[#8B8F9E]" strokeWidth={2} aria-hidden />
              <span className="truncate font-inter text-[11px] text-[#8B8F9E]">In the activity · sent to Gio Sales</span>
            </div>
            <Button ref={cancelRef} type="button" variant="secondary" size="md" disabled={change.isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="change-hire-credit"
              variant="primary"
              size="md"
              icon={UserCog}
              loading={change.isPending}
              aria-disabled={!ready || undefined}
              style={ready ? undefined : { opacity: 0.4, pointerEvents: 'none' }}
            >
              Change credit
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Pill({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className="min-w-0 flex-1"
      style={{
        background: accent ? '#F5EFFF' : '#FAFAF7',
        border: `1px solid ${accent ? '#DFCBFB' : '#EDECE6'}`,
        borderRadius: 9,
        padding: '7px 10px',
      }}
    >
      <div
        className="truncate font-inter"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent ? '#5B21B6' : '#5A6072', opacity: 0.75 }}
      >
        {label}
      </div>
      <div className="mt-0.5 truncate font-inter text-[12px] font-medium" style={{ color: accent ? '#5B21B6' : '#1F2230' }}>
        {value}
      </div>
    </div>
  )
}
