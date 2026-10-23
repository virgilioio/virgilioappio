import { useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ArrowRight, CalendarDays, Check, History, Percent, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AffixInput } from '@/components/ui/affix-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { shakeFirstInvalid } from '@/lib/motion'
import {
  COMMISSION_ROLES,
  commissionRoleLabel,
  rateFor,
  todayIso,
  useAddCommissionRate,
  type CommissionRate,
  type CommissionRoleKey,
} from '@/lib/os/commissions'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const day = (s: string) => fromIso(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const pctText = (n: number) => `${Number.isInteger(n) ? n : Number(n.toFixed(2))}%`

/** The usual dates a new rate starts on, so most changes need no calendar. */
function presets() {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const q = Math.floor(now.getMonth() / 3)
  const nextQuarter = new Date(now.getFullYear(), (q + 1) * 3, 1)
  const nextYear = new Date(now.getFullYear() + 1, 0, 1)
  const list = [
    { id: 'today', title: 'Today', date: iso(now) },
    { id: 'month', title: 'Next month', date: iso(nextMonth) },
    { id: 'quarter', title: 'Next quarter', date: iso(nextQuarter) },
    { id: 'year', title: `Jan 1, ${nextYear.getFullYear()}`, date: iso(nextYear) },
  ]
  // Next quarter can be next month (or next year can be next quarter): keep one of each date.
  return list.filter((p, i) => list.findIndex((x) => x.date === p.date) === i)
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

/** A reserved line under a field (§7): the message never moves the form. */
function FieldMessage({ children }: { children?: string }) {
  return (
    <p className="gio-field-message mt-1.5 min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={children ? 'alert' : undefined}>
      {children ?? ''}
    </p>
  )
}

/**
 * Add a commission rate (Allan, 2026-10-23), in the frame of the ATS's
 * action dialogs (Add or transfer candidate, Reject): round badge, a title
 * that names what changes, selectable cards, a before → after strip and the
 * warm footer with Cancel first. The rate starts on its date; earlier invoices
 * keep theirs.
 */
export function AddCommissionRateDialog({
  open,
  onOpenChange,
  tenantId,
  rates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  rates: CommissionRate[]
}) {
  const add = useAddCommissionRate(tenantId)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [role, setRole] = useState<CommissionRoleKey | null>(null)
  const [pct, setPct] = useState('')
  const [preset, setPreset] = useState<string | null>(null)
  const [custom, setCustom] = useState<Date | undefined>(undefined)
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = presets()

  const reset = () => {
    setRole(null)
    setPct('')
    setPreset(null)
    setCustom(undefined)
    setShowNote(false)
    setNote('')
    setTried(false)
    setError(null)
  }
  const close = () => {
    if (add.isPending) return
    reset()
    onOpenChange(false)
  }

  const n = Number(pct)
  const from = preset === 'custom' ? (custom ? iso(custom) : null) : options.find((o) => o.id === preset)?.date ?? null
  const now = role ? rateFor(rates, role).current : null
  const problems = {
    role: !role ? 'Choose the role the rate is for.' : undefined,
    pct: pct.trim() === '' ? 'Enter the new rate.' : !Number.isFinite(n) || n < 0 || n > 100 ? 'Enter a rate from 0 to 100.' : undefined,
    from: !from ? 'Choose when it starts.' : undefined,
  }
  const ready = !problems.role && !problems.pct && !problems.from

  const submit = async () => {
    setTried(true)
    setError(null)
    if (!ready) {
      shakeFirstInvalid()
      return
    }
    const value = Math.round(n * 100) / 100
    try {
      await add.mutateAsync({ role_key: role!, pct: value, effective_from: from!, note: note.trim() || null })
      toast(`${commissionRoleLabel(role!)}: ${pctText(value)} from ${day(from!)}. Sending to Gio Sales.`)
      reset()
      onOpenChange(false)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const title = role ? `Change the ${commissionRoleLabel(role)} rate` : 'Add a commission rate'

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
            if (add.isPending) e.preventDefault()
          }}
          style={{
            width: 560,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EDE4FF] text-[#6F3FF5]">
              <Percent className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                The new rate applies to invoices Gio Sales issues from its start date.{' '}
                <span className="font-medium text-text-primary">Invoices already issued keep their rate</span>, and the
                current rate stays in the history.
              </DialogPrimitive.Description>
            </div>
          </header>

          <form
            id="add-commission-rate"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={{ padding: 24, gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            {/* 1 · Role */}
            <section>
              <FieldLabel id="rate-role-label" hint="Each person in the role on a placement shares this rate">
                Role
              </FieldLabel>
              <div role="radiogroup" aria-labelledby="rate-role-label" aria-invalid={tried && !!problems.role} className="flex flex-col gap-1">
                {COMMISSION_ROLES.map((r) => {
                  const selected = role === r.key
                  const current = rateFor(rates, r.key).current
                  return (
                    <button
                      key={r.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={add.isPending}
                      onClick={() => setRole(r.key)}
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
                      <span className="flex min-w-0 flex-1 items-baseline gap-2">
                        <span className={`shrink-0 font-poppins text-[13px] font-semibold ${selected ? 'text-[#5B21B6]' : 'text-[#1F2230]'}`}>
                          {r.label}
                        </span>
                        <span className="hidden truncate font-inter text-[11.5px] text-[#8B8F9E] sm:inline">{r.source}</span>
                      </span>
                      <span className="shrink-0 font-inter text-[12.5px] tabular-nums text-[#5A6072]">
                        <span className="font-semibold text-[#1F2230]">{current ? pctText(current.pct) : '—'}</span> now
                      </span>
                    </button>
                  )
                })}
              </div>
              <FieldMessage>{tried ? problems.role : undefined}</FieldMessage>
            </section>

            {/* 2 · Rate */}
            <section>
              <FieldLabel hint="Share of net collected revenue">New rate</FieldLabel>
              <div className="max-w-[200px]">
                <AffixInput
                  id="rate-pct"
                  numeric
                  inputMode="decimal"
                  suffix="%"
                  aria-label="New rate, percent"
                  placeholder={now ? String(now.pct) : '0'}
                  value={pct}
                  invalid={tried && !!problems.pct}
                  aria-invalid={tried && !!problems.pct}
                  disabled={add.isPending}
                  onChange={(e) => setPct(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))}
                />
              </div>
              <FieldMessage>{tried ? problems.pct : undefined}</FieldMessage>
            </section>

            {/* 3 · Start date */}
            <section>
              <FieldLabel hint="Today or later">Starts</FieldLabel>
              <div role="radiogroup" aria-label="Starts" aria-invalid={tried && !!problems.from} className="flex flex-wrap gap-1.5">
                {[...options.map((o) => ({ id: o.id, title: o.title, sub: day(o.date) })), { id: 'custom', title: 'Pick a date', sub: custom ? day(iso(custom)) : 'Any day from today' }].map((o) => {
                  const selected = preset === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={add.isPending}
                      onClick={() => setPreset(o.id)}
                      className="gio-pressable min-w-0 flex-1 text-left transition-colors duration-hover"
                      style={{
                        flexBasis: 96,
                        padding: '7px 10px',
                        borderRadius: 9,
                        background: selected ? '#F5EFFF' : '#FFFFFF',
                        border: `1px solid ${selected ? '#DFCBFB' : '#E7E8EE'}`,
                        boxShadow: selected ? 'inset 0 0 0 1px #DFCBFB' : undefined,
                      }}
                    >
                      <span className={`flex items-center gap-1 truncate font-poppins text-[12px] font-medium ${selected ? 'text-[#5B21B6]' : 'text-[#1F2230]'}`}>
                        {o.id === 'custom' && <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />}
                        <span className="truncate">{o.title}</span>
                      </span>
                      <span className="block truncate font-inter text-[10.5px] tabular-nums text-[#8B8F9E]">{o.sub}</span>
                    </button>
                  )
                })}
              </div>
              {preset === 'custom' && (
                <div className="mt-2 max-w-[240px]">
                  <DatePickerVirgilio value={custom} onChange={setCustom} placeholder="Pick a date" minDate={fromIso(todayIso())} className="w-full" />
                </div>
              )}
              <FieldMessage>{tried ? problems.from : undefined}</FieldMessage>
            </section>

            {/* 4 · Note */}
            <section>
              {!showNote ? (
                <button
                  type="button"
                  onClick={() => setShowNote(true)}
                  className="inline-flex items-center gap-1.5 font-poppins text-[12.5px] font-medium text-[#6F3FF5] transition-colors duration-hover hover:underline"
                >
                  <Plus size={13} aria-hidden />
                  Add a note
                </button>
              ) : (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="rate-note" className="font-poppins text-[12px] font-semibold text-[#1F2230]">
                      Note <span className="font-normal text-[#8B8F9E]">· optional</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNote(false)
                        setNote('')
                      }}
                      className="font-inter text-[11.5px] text-[#8B8F9E] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    id="rate-note"
                    autoFocus
                    value={note}
                    maxLength={300}
                    rows={2}
                    disabled={add.isPending}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="For example, the agreement or decision it comes from"
                    className="gio-field w-full resize-none rounded-[9px] border border-[#E0DDD3] bg-white px-3 py-2.5 font-inter text-[13px] text-[#1F2230]"
                  />
                </div>
              )}
            </section>

            {/* 5 · Before → after */}
            {role && !problems.pct && from && (
              <div className="mt-3 flex items-center gap-2">
                <Pill label="Now" value={now ? `${pctText(now.pct)} since ${day(now.effective_from)}` : 'No rate yet'} />
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#8B8F9E]" aria-hidden />
                <Pill label={`From ${day(from)}`} value={pctText(Math.round(n * 100) / 100)} accent />
              </div>
            )}
            {error && (
              <p className="mt-3 rounded-[10px] border border-[#F3D0CC] bg-[#FEF4F4] px-3 py-2 font-inter text-[12.5px] text-[#B91C1C]" role="alert">
                {error}
              </p>
            )}
          </form>

          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <div className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
              <History className="h-3 w-3 shrink-0 text-[#8B8F9E]" strokeWidth={2} aria-hidden />
              <span className="truncate font-inter text-[11px] text-[#8B8F9E]">Recorded in the history · sent to Gio Sales</span>
            </div>
            <Button ref={cancelRef} type="button" variant="secondary" size="md" disabled={add.isPending} onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-commission-rate"
              variant="primary"
              size="md"
              icon={Percent}
              loading={add.isPending}
              style={ready ? undefined : { opacity: 0.4 }}
            >
              {role ? 'Save new rate' : 'Add rate'}
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
      <div className="mt-0.5 truncate font-inter text-[12px] font-medium tabular-nums" style={{ color: accent ? '#5B21B6' : '#1F2230' }}>
        {value}
      </div>
    </div>
  )
}
