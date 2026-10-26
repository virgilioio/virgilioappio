import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CalendarDays, Check, CircleStop, History, Percent, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { AffixInput } from '@/components/ui/affix-input'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { shakeFirstInvalid } from '@/lib/motion'
import {
  CURRENCIES,
  dayText,
  FEES,
  PERSON_SOURCES,
  ruleSentence,
  sourceLabel,
  todayIso,
  useAddRule,
  useSaveRole,
  type CommissionRole,
  type CommissionRule,
  type FeeKey,
  type PersonSource,
  type RuleInput,
} from '@/lib/os/commissionRules'

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fromIso = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** The usual start dates, so most changes need no calendar. */
function presets() {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3)
  const list = [
    { id: 'today', title: 'Today', date: iso(now) },
    { id: 'month', title: 'Next month', date: iso(new Date(now.getFullYear(), now.getMonth() + 1, 1)) },
    { id: 'quarter', title: 'Next quarter', date: iso(new Date(now.getFullYear(), (q + 1) * 3, 1)) },
    { id: 'year', title: `Jan 1, ${now.getFullYear() + 1}`, date: iso(new Date(now.getFullYear() + 1, 0, 1)) },
  ]
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

/** One sliding layer between options (§14), the ATS's segmented look. */
function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: {
  value: T
  options: { id: T; label: string; disabled?: boolean }[]
  onChange: (v: T) => void
  label: string
  disabled?: boolean
}) {
  const segRef = useSegmentLayer<HTMLDivElement>()
  return (
    <div
      ref={segRef}
      role="radiogroup"
      aria-label={label}
      className="gio-seg inline-flex max-w-full flex-wrap"
      style={{ gap: 2, padding: 3, background: '#ECEAE2', borderRadius: 9 }}
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-seg-option
            data-active={active || undefined}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.id)}
            className="whitespace-nowrap font-inter text-[13px] font-medium disabled:opacity-40"
            style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: 'transparent', color: active ? '#1F2230' : '#5A6072' }}
          >
            {o.label}
          </button>
        )
      })}
      <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
    </div>
  )
}

/** Start date: the usual dates as cards, or any day from the calendar. */
function StartPicker({
  value,
  onChange,
  invalid,
  disabled,
  label = 'Starts',
}: {
  value: string | null
  onChange: (v: string | null) => void
  invalid?: boolean
  disabled?: boolean
  label?: string
}) {
  const options = presets()
  const [custom, setCustom] = useState(false)
  const picked = custom ? 'custom' : options.find((o) => o.date === value)?.id ?? (value ? 'custom' : null)
  return (
    <>
      <div role="radiogroup" aria-label={label} aria-invalid={invalid} className="flex flex-wrap gap-1.5">
        {[...options.map((o) => ({ id: o.id, title: o.title, sub: dayText(o.date), date: o.date as string | null })), { id: 'custom', title: 'Pick a date', sub: picked === 'custom' && value ? dayText(value) : 'Any day from today', date: null }].map((o) => {
          const selected = picked === o.id
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => {
                setCustom(o.id === 'custom')
                onChange(o.id === 'custom' ? (picked === 'custom' ? value : null) : o.date)
              }}
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
      {picked === 'custom' && (
        <div className="mt-2 max-w-[240px]">
          <DatePickerVirgilio
            value={value ? fromIso(value) : undefined}
            onChange={(d) => onChange(iso(d))}
            placeholder="Pick a date"
            minDate={fromIso(todayIso())}
            className="w-full"
          />
        </div>
      )}
    </>
  )
}

/** The ATS's action-dialog frame: round badge, a title that names what changes, warm footer with Cancel first. */
function Frame({
  open,
  onClose,
  busy,
  icon: Icon,
  title,
  description,
  formId,
  submitLabel,
  submitIcon,
  ready,
  danger,
  footnote,
  children,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  busy: boolean
  icon: typeof Percent
  title: string
  description: React.ReactNode
  formId: string
  submitLabel: string
  submitIcon?: typeof Percent
  ready: boolean
  danger?: boolean
  footnote: string
  children: React.ReactNode
  onSubmit: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="gio-dialog-overlay fixed inset-0 z-[60]" style={{ background: 'rgba(13,13,9,0.34)' }} />
        <DialogPrimitive.Content
          className="gio-dialog fixed left-1/2 top-1/2 z-[70] flex flex-col overflow-hidden bg-white [translate:-50%_-50%] focus:outline-none"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault()
          }}
          style={{
            width: 580,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 48px)',
            borderRadius: 18,
            boxShadow: '0 28px 90px -14px rgba(13,13,9,0.42), 0 0 0 1px rgba(13,13,9,0.04)',
          }}
        >
          <header className="flex shrink-0 items-start gap-[14px]" style={{ padding: '22px 24px 18px', borderBottom: '1px solid #F1F0EC' }}>
            <span
              aria-hidden="true"
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${danger ? 'bg-[#FEF4F4] text-[#C2372B]' : 'bg-[#EDE4FF] text-[#6F3FF5]'}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="mt-0.5 line-clamp-2 break-words font-poppins text-[17px] font-semibold leading-snug text-text-primary [text-wrap:pretty]">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 font-inter text-[13px] leading-[1.5] text-text-secondary [text-wrap:pretty]">
                {description}
              </DialogPrimitive.Description>
            </div>
          </header>
          <form
            id={formId}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            style={{ padding: 24, gap: 6 }}
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
          >
            {children}
          </form>
          <footer className="flex shrink-0 items-center justify-end gap-3" style={{ padding: '13px 24px', borderTop: '1px solid #F1F0EC', background: '#FAFAF7' }}>
            <div className="hidden min-w-0 flex-1 items-center gap-1.5 sm:flex">
              <History className="h-3 w-3 shrink-0 text-[#8B8F9E]" strokeWidth={2} aria-hidden />
              <span className="truncate font-inter text-[11px] text-[#8B8F9E]">{footnote}</span>
            </div>
            <Button ref={cancelRef} type="button" variant="secondary" size="md" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant={danger ? 'dangerSolid' : 'primary'}
              size="md"
              icon={submitIcon}
              loading={busy}
              style={ready ? undefined : { opacity: 0.4 }}
            >
              {submitLabel}
            </Button>
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ErrorBox({ children }: { children: string | null }) {
  if (!children) return null
  return (
    <p className="mt-3 rounded-[10px] border border-[#F3D0CC] bg-[#FEF4F4] px-3 py-2 font-inter text-[12.5px] text-[#B91C1C]" role="alert">
      {children}
    </p>
  )
}

/** Add a role, or change a role's name and description (where its person comes from never changes). */
export function RoleDialog({
  open,
  onOpenChange,
  tenantId,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  role: CommissionRole | null
}) {
  const save = useSaveRole(tenantId)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState<PersonSource | null>(null)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLabel(role?.label ?? '')
    setDescription(role?.description ?? '')
    setSource(role?.person_source ?? null)
    setTried(false)
    setError(null)
  }, [open, role])

  const problems = {
    label: !label.trim() ? 'Name the role.' : label.trim().length > 60 ? 'Keep the name to 60 characters.' : undefined,
    source: !source ? 'Choose where its person comes from.' : undefined,
  }
  const ready = !problems.label && !problems.source
  const close = () => onOpenChange(false)
  const submit = async () => {
    setTried(true)
    setError(null)
    if (!ready) return shakeFirstInvalid()
    try {
      await save.mutateAsync({ id: role?.id, input: { label: label.trim(), description: description.trim() || null, person_source: source! } })
      toast(role ? `${label.trim()} saved` : `${label.trim()} added. Give it a rule so it earns something.`)
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const groups = [...new Set(PERSON_SOURCES.map((s) => s.group))]
  return (
    <Frame
      open={open}
      onClose={close}
      busy={save.isPending}
      icon={UserPlus}
      title={role ? `Edit ${role.label}` : 'Add a commission role'}
      description={
        role
          ? 'Change its name or description. Where its person comes from stays as it is; for another source, add a new role.'
          : 'A role is who gets paid. Pick where its person comes from on a deal, then give it rules.'
      }
      formId="commission-role"
      submitLabel={role ? 'Save role' : 'Add role'}
      ready={ready}
      footnote="Recorded in the history"
      onSubmit={() => void submit()}
    >
      <section>
        <FieldLabel>Name</FieldLabel>
        <input
          aria-label="Role name"
          value={label}
          maxLength={60}
          disabled={save.isPending}
          aria-invalid={tried && !!problems.label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="For example, Closer"
          className="gio-field h-10 w-full rounded-[9px] border border-[#E0DDD3] bg-white px-3 font-inter text-[13.5px] text-[#1F2230]"
        />
        <FieldMessage>{tried ? problems.label : undefined}</FieldMessage>
      </section>
      <section>
        <FieldLabel hint="Optional">Description</FieldLabel>
        <textarea
          aria-label="Description"
          value={description}
          maxLength={300}
          rows={2}
          disabled={save.isPending}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Who this is, in a sentence"
          className="gio-field w-full resize-none rounded-[9px] border border-[#E0DDD3] bg-white px-3 py-2.5 font-inter text-[13px] text-[#1F2230]"
        />
        <FieldMessage />
      </section>
      <section>
        <FieldLabel id="role-source-label">Who it is on a deal</FieldLabel>
        {role ? (
          <p className="rounded-[10px] bg-[#F7F6F2] px-3 py-2.5 font-inter text-[13px] text-[#1F2230]">{sourceLabel(role.person_source)}</p>
        ) : (
          <div role="radiogroup" aria-labelledby="role-source-label" aria-invalid={tried && !!problems.source} className="flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g}>
                <div className="mb-1 font-inter text-[11px] text-[#8B8F9E]">{g}</div>
                <div className="flex flex-col gap-1">
                  {PERSON_SOURCES.filter((s) => s.group === g).map((s) => {
                    const selected = source === s.key
                    return (
                      <button
                        key={s.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={save.isPending}
                        onClick={() => setSource(s.key)}
                        className="gio-pressable flex items-center gap-3 text-left transition-colors duration-hover"
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: selected ? '#F5EFFF' : '#FFFFFF',
                          border: `1px solid ${selected ? '#DFCBFB' : '#EDECE6'}`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full"
                          style={{ background: selected ? '#6F3FF5' : '#FFFFFF', border: `1px solid ${selected ? '#6F3FF5' : '#D4D2CA'}` }}
                        >
                          {selected && <Check className="h-3 w-3 text-white" strokeWidth={2.2} />}
                        </span>
                        <span className={`font-poppins text-[13px] font-semibold ${selected ? 'text-[#5B21B6]' : 'text-[#1F2230]'}`}>{s.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <FieldMessage>{tried ? problems.source : undefined}</FieldMessage>
      </section>
      <ErrorBox>{error}</ErrorBox>
    </Frame>
  )
}

type Draft = {
  basis: 'percent' | 'fixed'
  pct: string
  amount: string
  currency: string
  payable_on: 'payment' | 'lead_accepted'
  applies_to: 'services' | 'partner_items'
  fees: FeeKey[]
  client: 'any' | 'new' | 'existing'
  partner_items: 'any' | 'fixed' | 'recurring'
  timed: boolean
  months: string
  effective_from: string | null
  note: string
}

const blank: Draft = {
  basis: 'percent',
  pct: '',
  amount: '',
  currency: 'USD',
  payable_on: 'payment',
  applies_to: 'services',
  fees: FEES.filter((f) => f.key !== 'engagement').map((f) => f.key),
  client: 'any',
  partner_items: 'any',
  timed: false,
  months: '12',
  effective_from: null,
  note: '',
}

const draftFrom = (r: CommissionRule): Draft => ({
  basis: r.basis,
  pct: r.pct != null ? String(r.pct) : '',
  amount: r.amount != null ? String(r.amount) : '',
  currency: r.currency ?? 'USD',
  payable_on: r.payable_on,
  applies_to: r.applies_to,
  fees: r.fees ?? FEES.map((f) => f.key),
  client: r.client,
  partner_items: r.partner_items,
  timed: r.months != null,
  months: r.months != null ? String(r.months) : '12',
  effective_from: null,
  note: '',
})

/**
 * Add a rule to a role, change one (a new version from a date) or stop one.
 * A built-in role's rule keeps its terms: only its rate and date change.
 */
export function RuleDialog({
  open,
  onOpenChange,
  tenantId,
  role,
  rule,
  mode,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  role: CommissionRole
  /** The rule being changed or stopped (its latest version). */
  rule: CommissionRule | null
  mode: 'add' | 'change' | 'stop'
}) {
  const add = useAddRule(tenantId)
  const [d, setD] = useState<Draft>(blank)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const termsLocked = role.built_in && mode !== 'add'

  useEffect(() => {
    if (!open) return
    setD(rule ? draftFrom(rule) : blank)
    setTried(false)
    setError(null)
  }, [open, rule])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const pct = Number(d.pct)
  const amount = Number(d.amount)
  const months = Number(d.months)
  const problems =
    mode === 'stop'
      ? { from: !d.effective_from ? 'Choose when it stops.' : undefined }
      : {
          pct: d.basis === 'percent' && (d.pct.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > 100) ? 'Enter a percentage from 0 to 100.' : undefined,
          amount: d.basis === 'fixed' && (d.amount.trim() === '' || !Number.isFinite(amount) || amount <= 0) ? 'Enter the amount.' : undefined,
          fees: d.applies_to === 'services' && d.fees.length === 0 ? 'Pick at least one fee.' : undefined,
          months: d.timed && (!Number.isInteger(months) || months < 1 || months > 120) ? 'Enter 1 to 120 months.' : undefined,
          from: !d.effective_from ? 'Choose when it starts.' : undefined,
        }
  const ready = Object.values(problems).every((p) => !p)

  const input = (): RuleInput => ({
    basis: d.basis,
    pct: d.basis === 'percent' ? Math.round(pct * 100) / 100 : null,
    amount: d.basis === 'fixed' ? Math.round(amount * 100) / 100 : null,
    currency: d.basis === 'fixed' ? d.currency : null,
    payable_on: d.payable_on,
    applies_to: d.applies_to,
    fees: d.applies_to === 'services' ? (d.fees.length === FEES.length ? null : d.fees) : null,
    client: d.client,
    partner_items: d.payable_on === 'lead_accepted' ? 'fixed' : d.partner_items,
    months: d.timed ? months : null,
    effective_from: d.effective_from!,
    note: d.note.trim() || null,
    stopped: mode === 'stop',
  })

  const close = () => onOpenChange(false)
  const submit = async () => {
    setTried(true)
    setError(null)
    if (!ready) return shakeFirstInvalid()
    try {
      await add.mutateAsync({ roleId: role.id, seriesId: mode === 'add' ? undefined : rule!.series_id, input: input() })
      toast(
        mode === 'stop'
          ? `${role.label}: the rule stops on ${dayText(d.effective_from!)}.`
          : mode === 'change'
            ? `${role.label}: the new terms start on ${dayText(d.effective_from!)}.`
            : `${role.label}: rule added from ${dayText(d.effective_from!)}.`,
      )
      close()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const preview = mode !== 'stop' && ready ? ruleSentence(input()) : null
  const title =
    mode === 'stop' ? `Stop the ${role.label} rule` : mode === 'change' ? (role.built_in ? `Change the ${role.label} rate` : `Change the ${role.label} rule`) : `Add a rule to ${role.label}`

  return (
    <Frame
      open={open}
      onClose={close}
      busy={add.isPending}
      icon={mode === 'stop' ? CircleStop : Percent}
      danger={mode === 'stop'}
      title={title}
      description={
        mode === 'stop' ? (
          <>
            <span className="font-medium text-text-primary">{rule ? ruleSentence(rule) : ''}</span> stops on the day you pick. Invoices issued before
            then keep it, and it stays in the history.
          </>
        ) : (
          <>
            {mode === 'change' ? 'The new terms apply from their start date. ' : 'The rule applies from its start date. '}
            <span className="font-medium text-text-primary">Invoices already issued keep what they were issued with</span>, and every version stays in the
            history.
          </>
        )
      }
      formId="commission-rule"
      submitLabel={mode === 'stop' ? 'Stop rule' : mode === 'change' ? 'Save new version' : 'Add rule'}
      submitIcon={mode === 'stop' ? CircleStop : Percent}
      ready={ready}
      footnote={role.built_in ? 'Recorded in the history · sent to Gio Sales' : 'Recorded in the history'}
      onSubmit={() => void submit()}
    >
      {mode !== 'stop' && (
        <>
          <section>
            <FieldLabel>Pays</FieldLabel>
            <Seg
              label="Pays"
              value={d.basis}
              disabled={termsLocked || add.isPending}
              onChange={(v) => setD((x) => ({ ...x, basis: v, payable_on: v === 'percent' ? 'payment' : x.payable_on }))}
              options={[
                { id: 'percent', label: 'A percentage' },
                { id: 'fixed', label: 'A fixed amount' },
              ]}
            />
            <div className="mt-2 flex max-w-[320px] gap-2">
              {d.basis === 'percent' ? (
                <div className="w-[160px]">
                  <AffixInput
                    numeric
                    inputMode="decimal"
                    suffix="%"
                    aria-label="Percentage"
                    placeholder="10"
                    value={d.pct}
                    invalid={tried && !!problems.pct}
                    aria-invalid={tried && !!problems.pct}
                    disabled={add.isPending}
                    onChange={(e) => set('pct', e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))}
                  />
                </div>
              ) : (
                <>
                  <div className="w-[160px]">
                    <AffixInput
                      numeric
                      inputMode="decimal"
                      aria-label="Amount"
                      placeholder="100"
                      value={d.amount}
                      invalid={tried && !!problems.amount}
                      aria-invalid={tried && !!problems.amount}
                      disabled={add.isPending}
                      onChange={(e) => set('amount', e.target.value.replace(/[^0-9.]/g, '').slice(0, 10))}
                    />
                  </div>
                  <select
                    aria-label="Currency"
                    value={d.currency}
                    disabled={add.isPending || termsLocked}
                    onChange={(e) => set('currency', e.target.value)}
                    className="gio-field h-10 rounded-[9px] border border-[#E0DDD3] bg-white px-2 font-inter text-[13px] text-[#1F2230]"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <FieldMessage>{tried ? problems.pct ?? problems.amount : undefined}</FieldMessage>
          </section>

          {!termsLocked && (
            <>
              <section>
                <FieldLabel hint={d.basis === 'percent' ? 'Of what Billing records as paid' : undefined}>When it's payable</FieldLabel>
                <Seg
                  label="When it's payable"
                  value={d.payable_on}
                  disabled={add.isPending}
                  onChange={(v) => setD((x) => ({ ...x, payable_on: v, ...(v === 'lead_accepted' ? { applies_to: 'partner_items' as const, partner_items: 'fixed' as const } : {}) }))}
                  options={[
                    { id: 'payment', label: 'As each payment is recorded' },
                    { id: 'lead_accepted', label: 'When a partner accepts the lead', disabled: d.basis !== 'fixed' },
                  ]}
                />
                <FieldMessage />
              </section>

              <section>
                <FieldLabel>On what</FieldLabel>
                <Seg
                  label="On what"
                  value={d.applies_to}
                  disabled={add.isPending}
                  onChange={(v) => set('applies_to', v)}
                  options={[
                    { id: 'services', label: "Virgilio's services", disabled: d.payable_on === 'lead_accepted' },
                    { id: 'partner_items', label: 'Partner items' },
                  ]}
                />
                {d.applies_to === 'services' ? (
                  <div className="mt-2.5 flex flex-col gap-2.5">
                    <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Fees">
                      {FEES.map((f) => (
                        <label key={f.key} className="inline-flex cursor-pointer items-center gap-2 font-inter text-[13px] text-[#1F2230]">
                          <Checkbox
                            checked={d.fees.includes(f.key)}
                            disabled={add.isPending}
                            onCheckedChange={(c) => set('fees', c === true ? [...d.fees, f.key] : d.fees.filter((x) => x !== f.key))}
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                    <Seg
                      label="Clients"
                      value={d.client}
                      disabled={add.isPending}
                      onChange={(v) => set('client', v)}
                      options={[
                        { id: 'any', label: 'Any client' },
                        { id: 'new', label: 'New clients' },
                        { id: 'existing', label: 'Existing clients' },
                      ]}
                    />
                  </div>
                ) : (
                  <div className="mt-2.5">
                    <Seg
                      label="Partner items"
                      value={d.payable_on === 'lead_accepted' ? 'fixed' : d.partner_items}
                      disabled={add.isPending || d.payable_on === 'lead_accepted'}
                      onChange={(v) => set('partner_items', v)}
                      options={[
                        { id: 'any', label: 'All partner items' },
                        { id: 'fixed', label: 'Fixed amounts' },
                        { id: 'recurring', label: 'Recurring (percentage)' },
                      ]}
                    />
                  </div>
                )}
                <FieldMessage>{tried ? problems.fees : undefined}</FieldMessage>
              </section>

              <section>
                <FieldLabel hint={d.timed ? 'Counted from the first paid invoice for each client' : undefined}>For how long</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <Seg
                    label="For how long"
                    value={d.timed ? 'months' : 'always'}
                    disabled={add.isPending}
                    onChange={(v) => set('timed', v === 'months')}
                    options={[
                      { id: 'always', label: 'Always' },
                      { id: 'months', label: 'A number of months' },
                    ]}
                  />
                  {d.timed && (
                    <div className="w-[150px]">
                      <AffixInput
                        numeric
                        inputMode="numeric"
                        suffix="months"
                        aria-label="Months"
                        value={d.months}
                        invalid={tried && !!problems.months}
                        aria-invalid={tried && !!problems.months}
                        disabled={add.isPending}
                        onChange={(e) => set('months', e.target.value.replace(/\D/g, '').slice(0, 3))}
                      />
                    </div>
                  )}
                </div>
                <FieldMessage>{tried ? problems.months : undefined}</FieldMessage>
              </section>
            </>
          )}
        </>
      )}

      <section>
        <FieldLabel hint="Today or later">{mode === 'stop' ? 'Stops' : 'Starts'}</FieldLabel>
        <StartPicker
          label={mode === 'stop' ? 'Stops' : 'Starts'}
          value={d.effective_from}
          onChange={(v) => set('effective_from', v)}
          invalid={tried && !!problems.from}
          disabled={add.isPending}
        />
        <FieldMessage>{tried ? problems.from : undefined}</FieldMessage>
      </section>

      <section>
        <FieldLabel hint="Optional">Note</FieldLabel>
        <textarea
          aria-label="Note"
          value={d.note}
          maxLength={300}
          rows={2}
          disabled={add.isPending}
          onChange={(e) => set('note', e.target.value)}
          placeholder="For example, the agreement or decision it comes from"
          className="gio-field w-full resize-none rounded-[9px] border border-[#E0DDD3] bg-white px-3 py-2.5 font-inter text-[13px] text-[#1F2230]"
        />
      </section>

      {preview && (
        <p className="mt-2 rounded-[10px] border border-[#DFCBFB] bg-[#F5EFFF] px-3 py-2 font-inter text-[12.5px] text-[#5B21B6]">
          {role.label} earns {preview}.
        </p>
      )}
      <ErrorBox>{error}</ErrorBox>
    </Frame>
  )
}
