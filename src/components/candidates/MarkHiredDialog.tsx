import { FormEvent, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle2, Loader2, Receipt } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import { useJobOpenings } from '@/hooks/useJobOpenings'
import { useJobAssignments } from '@/hooks/useJobAssignments'
import { useMembers } from '@/hooks/useMembers'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast as legacyToast } from '@/hooks/use-toast'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MarkHiredDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  candidateId: string
  candidateName: string
  jobId: string
  onSuccess: (result: { reqId: string; startDate: string }) => void
}

interface DealDisplay {
  title: string | null
  linked: boolean
}

function offerStartDate(fieldValues: Record<string, unknown> | undefined) {
  if (!fieldValues) return null
  const entry = Object.entries(fieldValues).find(([key, value]) =>
    /start.*date|date.*start/i.test(key) && typeof value === 'string',
  )
  return entry?.[1] as string | null
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function fieldKey(field: OfferFormField) {
  return `${field.field_name} ${field.field_label}`.toLowerCase()
}

function offerBaseSalary(fields: OfferFormField[], values: Record<string, unknown> | undefined) {
  if (!values) return null
  const salaryField = fields.find((field) => /base salary|base compensation|annual salary/.test(fieldKey(field)))
    || fields.find((field) => field.field_type === 'salary')
  if (!salaryField) return null
  const raw = values[salaryField.field_name]
  let amount: number | null = null
  let currency = 'USD'
  if (typeof raw === 'number') amount = raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      amount = Number(parsed?.amount)
      currency = parsed?.currency || currency
    } catch {
      amount = Number(raw.replace(/[^0-9.-]/g, ''))
    }
  }
  if (raw && typeof raw === 'object') {
    const salary = raw as { amount?: unknown; currency?: unknown }
    amount = Number(salary.amount)
    if (typeof salary.currency === 'string') currency = salary.currency
  }
  const currencyField = fields.find((field) => /currency/.test(fieldKey(field)))
  if (currencyField && typeof values[currencyField.field_name] === 'string') currency = values[currencyField.field_name] as string
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: currency === 'USD' ? 'narrowSymbol' : 'code',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}

export function MarkHiredDialog({
  open,
  onOpenChange,
  applicationId,
  candidateId,
  candidateName,
  jobId,
  onSuccess,
}: MarkHiredDialogProps) {
  const { openings, isLoading, refetch } = useJobOpenings(jobId)
  const { offerLetters } = useOfferLetters(candidateId)
  const jobOffers = offerLetters.filter((item) => item.job_id === jobId && item.status !== 'declined')
  const offer = jobOffers.find((item) => item.status === 'accepted') || jobOffers[0]
  const { fields } = useOfferFormFields(offer?.form_id || undefined)
  const [openingId, setOpeningId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closeJob, setCloseJob] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deal, setDeal] = useState<DealDisplay>({ title: null, linked: false })
  const { assignments } = useJobAssignments(open ? jobId : undefined)
  const { members } = useMembers(true)
  const [sourcerId, setSourcerId] = useState('')
  const [recruiterId, setRecruiterId] = useState('')
  const firstName = candidateName.trim().split(/\s+/)[0] || candidateName

  const pool = (role: 'sourcer' | 'recruiter') =>
    assignments
      .filter((assignment: any) => assignment.role === role && !assignment.deleted_at)
      .map((assignment) => {
        const member = members.find((item) => item.user_id === assignment.user_id)
        const name = `${member?.user_first_name || ''} ${member?.user_last_name || ''}`.trim() || member?.user_email || 'Member'
        return { id: assignment.user_id, name }
      })

  const sourcers = pool('sourcer')
  const recruiters = pool('recruiter')

  useEffect(() => {
    if (!open) return
    setSourcerId((current) => sourcers.some((person) => person.id === current) ? current : sourcers.length === 1 ? sourcers[0].id : '')
    setRecruiterId((current) => recruiters.some((person) => person.id === current) ? current : recruiters.length === 1 ? recruiters[0].id : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sourcers.map((person) => person.id).join(), recruiters.map((person) => person.id).join()])

  useEffect(() => {
    if (!open) return
    let active = true
    void supabase.from('jobs').select('sales_deal_id, sales_deal_title').eq('id', jobId).maybeSingle().then(({ data }) => {
      if (active) setDeal({ linked: Boolean(data?.sales_deal_id), title: data?.sales_deal_title || null })
    })
    return () => { active = false }
  }, [open, jobId])

  const eligible = useMemo(() => openings.filter((opening) => opening.status !== 'filled'), [openings])
  const selected = openings.find((opening) => opening.id === openingId)
  const remaining = eligible.filter((opening) => opening.id !== openingId)
  const isLastOpening = eligible.length === 1 && eligible[0]?.id === openingId
  const salary = offerBaseSalary(fields, offer?.field_values)

  useEffect(() => {
    if (!open || openings.length === 0) return
    const preferred = openings.find((opening) => opening.id === offer?.opening_id && opening.status !== 'filled')
      || eligible.find((opening) => opening.status === 'open' || opening.candidate_id === candidateId)
    if (!preferred) return
    setOpeningId(preferred.id)
    const startField = fields.find((field) => /start.*date|date.*start/i.test(`${field.field_name} ${field.field_label}`))
    const confirmedStart = startField && typeof offer?.field_values?.[startField.field_name] === 'string'
      ? offer.field_values[startField.field_name]
      : offerStartDate(offer?.field_values)
    setStartDate(confirmedStart || preferred.target_start_date || '')
    setCloseJob(eligible.length === 1)
  }, [open, openings, offer?.opening_id, fields])

  const chooseOpening = (id: string) => {
    const next = openings.find((opening) => opening.id === id)
    setOpeningId(id)
    if (next?.target_start_date) setStartDate(next.target_start_date)
    setCloseJob(eligible.length === 1)
  }

  const confirmHire = async () => {
    if (!openingId || !startDate || !sourcerId || !recruiterId) return
    setSaving(true)
    const { data, error } = await (supabase as any).rpc('mark_hired', {
      p_application_id: applicationId,
      p_opening_id: openingId,
      p_start_date: startDate,
      p_close_job: closeJob,
      p_sourcer_id: sourcerId,
      p_recruiter_id: recruiterId,
    })
    setSaving(false)

    if (error) {
      const race = /just filled|that opening/i.test(error.message || '')
      legacyToast({
        title: race ? 'Opening no longer available' : 'Could not mark candidate hired',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      })
      await refetch()
      return
    }

    const result = Array.isArray(data) ? data[0] : data
    const reqId = result?.req_id || selected?.req_id || ''
    onSuccess({ reqId, startDate })
    onOpenChange(false)
    toast.custom(
      () => (
        <div className="flex items-center gap-2 rounded-[10px] bg-hire-ink px-3.5 py-2.5 font-inter text-[12.5px] text-hire-cream shadow-hire-toast">
          <CheckCircle2 className="size-[15px] shrink-0 text-hire-success-check" aria-hidden />
          <span>{firstName} marked hired · {reqId} filled</span>
        </div>
      ),
      { duration: 3000 },
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!saving && openingId && startDate && sourcerId && recruiterId && eligible.length > 0) void confirmHire()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-hire-title/30"
        closeClassName="right-[18px] top-[18px] flex size-7 items-center justify-center rounded-lg text-hire-secondary opacity-100 hover:bg-hire-soft focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hire-ink/10 data-[state=open]:bg-transparent"
        className="w-[calc(100%-32px)] max-w-[480px] gap-0 overflow-hidden rounded-[14px] border-0 bg-card p-0 font-inter text-hire-ink shadow-hire-dialog"
      >
        <form onSubmit={submit}>
          <DialogHeader className="gap-0 px-[22px] pb-1 pt-5 pr-14 text-left">
            <DialogTitle className="font-poppins text-[17px] font-semibold leading-[1.25] tracking-[-0.025em] text-hire-title">
              Mark {firstName} hired<span className="text-purple-period">.</span>
            </DialogTitle>
            <DialogDescription className="mt-1 font-inter text-[12.5px] leading-[1.5] text-hire-secondary">
              Pick the opening this hire fills. It&apos;s attached to {firstName}&apos;s record and counted against the Req ID.
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-1.5 px-[22px] pb-1 pt-3.5" aria-label="Opening">
            {isLoading ? (
              <div className="flex h-16 items-center justify-center text-[12px] text-hire-muted">
                <Loader2 className="mr-2 size-3.5 animate-spin" /> Loading openings…
              </div>
            ) : eligible.length === 0 ? (
              <p className="rounded-[10px] border border-hire-border-cool bg-hire-soft p-3 text-[12px] text-hire-secondary">
                This job has no unfilled openings.
              </p>
            ) : eligible.map((opening) => {
              const reservedForThisCandidate = opening.status === 'offer' && opening.candidate_id === candidateId
              const reservedForAnother = opening.status === 'offer' && opening.candidate_id !== candidateId
              const checked = openingId === opening.id
              return (
                <label
                  key={opening.id}
                  className={cn(
                    'flex min-h-[44px] cursor-pointer items-center gap-[11px] rounded-[10px] border border-hire-border-cool px-3 py-2.5 transition-[border-color,box-shadow] duration-100',
                    checked && 'border-hire-ink shadow-[0_0_0_1px_hsl(var(--hire-ink))]',
                    reservedForAnother && 'cursor-not-allowed opacity-55',
                  )}
                >
                  <input
                    type="radio"
                    name="hire-opening"
                    value={opening.id}
                    checked={checked}
                    disabled={reservedForAnother}
                    onChange={() => chooseOpening(opening.id)}
                    className="m-0 size-4 shrink-0 accent-hire-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hire-ink/10"
                  />
                  <span className="shrink-0 font-mono text-[12px] font-medium tracking-[0.01em] text-hire-ink">{opening.req_id}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-hire-secondary">
                    Hire by {format(new Date(`${opening.target_hire_date}T00:00:00`), 'MMM d')} · start {format(new Date(`${opening.target_start_date}T00:00:00`), 'MMM d')}
                  </span>
                  {reservedForThisCandidate && <Badge tone="neutral" size="xs">From offer</Badge>}
                  {reservedForAnother && <Badge tone="yellow" size="xs">Offer · {opening.candidate_name?.split(/\s+/)[0] || 'candidate'}</Badge>}
                </label>
              )
            })}
          </section>

          <section className="px-[22px] pb-1 pt-3">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-hire-muted">Credited on this hire</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                ['Sourcer', sourcers, sourcerId, setSourcerId],
                ['Recruiter', recruiters, recruiterId, setRecruiterId],
              ] as const).map(([label, people, value, set]) => {
                const selectedPerson = people.find((person) => person.id === value)
                return (
                  <div key={label} className="min-w-0">
                    <label className="mb-1 block text-[12px] font-medium text-hire-ink">{label} <span aria-hidden>*</span></label>
                    {people.length === 0 ? (
                      <div className="flex h-9 items-center gap-1 rounded-lg border border-dashed border-hire-toggle-off px-2.5 text-[12px] text-hire-muted">
                        <span className="min-w-0 flex-1 truncate">Assign a {label} to this job first</span>
                        <a href={`/jobs/${jobId}/setup#hiring-team`} className="shrink-0 font-medium text-hire-ink underline underline-offset-2">Hiring team</a>
                      </div>
                    ) : (
                      <Select value={value} onValueChange={(next) => set(next)}>
                        <SelectTrigger
                          aria-label={`${label}, required`}
                          className="h-9 rounded-lg border-hire-border bg-card px-2.5 font-inter text-[12.5px] text-hire-ink shadow-none hover:border-hire-hover-border hover:bg-card focus:border-hire-focus-border focus:ring-0 focus-visible:ring-[3px] focus-visible:ring-hire-ink/[0.06]"
                        >
                          <SelectValue placeholder={`Choose ${label.toLowerCase()}`}>
                            {selectedPerson && (
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-hire-hairline text-[10px] font-semibold text-hire-secondary">{initials(selectedPerson.name)}</span>
                                <span className="truncate">{selectedPerson.name}</span>
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-[10px] border-0 p-1.5 shadow-hire-menu">
                          {people.map((person) => (
                            <SelectItem key={person.id} value={person.id} className="h-8 pl-7 pr-2 text-hire-ink [&>span:first-child]:text-hire-ink">
                              <span className="flex items-center gap-2">
                                <span className="flex size-5 items-center justify-center rounded-full bg-hire-hairline text-[10px] font-semibold text-hire-secondary">{initials(person.name)}</span>
                                <span className="text-[12.5px]">{person.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] leading-[1.45] text-hire-muted">Each hire credits one Sourcer and one Recruiter. Billing uses them on the success fee.</p>
          </section>

          <section className="px-[22px] pb-1 pt-3">
            <label htmlFor="hire-start-date" className="mb-1 block text-[12px] font-medium text-hire-ink">Start date <span aria-hidden>*</span></label>
            <input
              id="hire-start-date"
              type="date"
              required
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="h-9 w-full rounded-lg border border-hire-border bg-card px-2.5 font-inter text-[12.5px] text-hire-ink [color-scheme:light] hover:border-hire-hover-border focus:border-hire-focus-border focus:outline-none focus:ring-[3px] focus:ring-hire-ink/[0.06] [&::-webkit-calendar-picker-indicator]:opacity-45"
            />
            {selected && (
              <p className="mt-1.5 text-[11px] leading-[1.45] text-hire-muted">
                From {firstName}&apos;s accepted offer. Target start for {selected.req_id} is {format(new Date(`${selected.target_start_date}T00:00:00`), 'MMM d, yyyy')}.
              </p>
            )}
          </section>

          {selected && (
            <section className="mx-[22px] mt-3 rounded-[10px] border border-hire-hairline bg-hire-soft px-3 py-2.5 text-[12px] leading-[1.5] text-hire-secondary">
              {isLastOpening ? (
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1">This fills the <strong className="font-semibold text-hire-ink">last opening</strong>. Close the job when {firstName} is marked hired.</p>
                  <Switch
                    aria-label="Close the job after this hire"
                    checked={closeJob}
                    onCheckedChange={setCloseJob}
                    className="h-[18px] w-8 border-0 bg-hire-toggle-off p-0 shadow-none data-[state=checked]:bg-hire-ink focus-visible:ring-[3px] focus-visible:ring-hire-ink/[0.06] focus-visible:ring-offset-0 [&>span]:size-3.5 [&>span]:bg-card [&>span]:shadow-sm data-[state=checked]:[&>span]:translate-x-[14px]"
                  />
                </div>
              ) : (
                <p>
                  <strong className="font-semibold text-hire-ink">{selected.req_id}</strong> will be filled. {remaining.length} {remaining.length === 1 ? 'opening stays' : 'openings stay'} open on this job ({remaining.map((opening) => opening.req_id).join(', ')}).
                </p>
              )}
            </section>
          )}

          {deal.linked && selected?.fee_pct != null && (
            <section className="mx-[22px] mt-2 flex items-start gap-[9px] rounded-[10px] border border-hire-success-border bg-hire-success-bg px-3 py-2.5 text-[12px] leading-[1.5] text-hire-ink">
              <Receipt className="mt-0.5 size-3.5 shrink-0 text-hire-success-icon" aria-hidden />
              <p>
                Gio Sales flags the <strong className="font-semibold">{selected.fee_pct}% success fee</strong>{deal.title ? ` on ${deal.title}` : ''} as ready to request{salary ? ` — ${selected.fee_pct}% × ${salary} base from the offer.` : '.'}
              </p>
            </section>
          )}

          <DialogFooter className="mt-4 flex-row justify-end gap-2 border-t border-hire-hairline px-[22px] py-4 sm:space-x-0">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-hire-border bg-card font-poppins text-hire-ink hover:bg-hire-soft focus-visible:ring-hire-ink/10"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={CheckCircle2}
              disabled={!openingId || !startDate || !sourcerId || !recruiterId || eligible.length === 0}
              loading={saving}
              className="bg-hire-title text-hire-cream hover:bg-hire-ink focus-visible:ring-hire-ink/10"
            >
              Mark hired{selected?.req_id ? ` · ${selected.req_id}` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}