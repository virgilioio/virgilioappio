import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, Landmark, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { LoadError } from '@/components/empty/LoadError'
import { useAuth } from '@/contexts/AuthContext'
import { CopyValue, EditToggle, InfoRow, InfoRows, ProfileCard } from '@/components/os/ProfileParts'
import { COUNTRIES } from '@/constants/countries'
import { shakeFirstInvalid } from '@/lib/motion'
import {
  KIND_LABEL,
  abaValid,
  bankErrorText,
  clabeBank,
  clabeValid,
  compact,
  digits,
  grouped,
  ibanValid,
  looksLikeIban,
  revealBankAccount,
  swiftValid,
  useBankDetails,
  useSaveBankDetails,
  type BankDetails,
  type BankDraft,
  type BankKind,
} from '@/lib/os/bank'

const REVEAL_MS = 30_000
const KINDS: BankKind[] = ['mx_clabe', 'us_account', 'intl']
const MX_CURRENCIES = [
  { value: 'MXN', label: 'MXN · Mexican peso' },
  { value: 'USD', label: 'USD · US dollar' },
]
const CURRENCIES = [
  { value: 'USD', label: 'USD · US dollar' },
  { value: 'EUR', label: 'EUR · Euro' },
  { value: 'GBP', label: 'GBP · British pound' },
  { value: 'CAD', label: 'CAD · Canadian dollar' },
  { value: 'MXN', label: 'MXN · Mexican peso' },
  { value: 'COP', label: 'COP · Colombian peso' },
  { value: 'BRL', label: 'BRL · Brazilian real' },
  { value: 'ARS', label: 'ARS · Argentine peso' },
  { value: 'CLP', label: 'CLP · Chilean peso' },
  { value: 'PEN', label: 'PEN · Peruvian sol' },
  { value: 'CHF', label: 'CHF · Swiss franc' },
  { value: 'INR', label: 'INR · Indian rupee' },
  { value: 'PHP', label: 'PHP · Philippine peso' },
]
const countryName = (code: string | null) => COUNTRIES.find((c) => c.value === code)?.label ?? code ?? ''

function fresh(kind: BankKind, from?: BankDetails | null): BankDraft {
  const same = from?.kind === kind
  return {
    kind,
    holder_name: from?.holder_name ?? '',
    bank_name: same ? from?.bank_name ?? '' : '',
    account: '',
    currency: same ? from?.currency ?? '' : kind === 'mx_clabe' ? 'MXN' : kind === 'us_account' ? 'USD' : '',
    country_code: same && kind === 'intl' ? from?.country_code ?? '' : '',
    routing_number: same ? from?.routing_number ?? '' : '',
    account_type: same ? from?.account_type ?? '' : '',
    swift: same ? from?.swift ?? '' : '',
  }
}

type Problems = Partial<Record<keyof BankDraft, string>>

/** The database's checks, worded the same, so a typo shows before Save. */
function problemsOf(d: BankDraft, keepsNumber: boolean): Problems {
  const p: Problems = {}
  const acct = compact(d.account)
  if (d.holder_name.trim().length < 2) p.holder_name = "Add the account holder's name, as the bank has it."
  if (d.kind === 'mx_clabe') {
    const c = digits(d.account)
    if (!c && !keepsNumber) p.account = 'Add the CLABE.'
    else if (c && c.length !== 18) p.account = 'A CLABE has 18 digits.'
    else if (c && !clabeValid(c)) p.account = "This CLABE doesn't add up: check the digits."
    if (!d.bank_name.trim() && !(c && clabeBank(c))) p.bank_name = "Add the bank's name."
  } else if (d.kind === 'us_account') {
    if (!abaValid(digits(d.routing_number))) p.routing_number = "This routing number doesn't add up: it has 9 digits, check them."
    const a = digits(d.account)
    if (!a && !keepsNumber) p.account = 'Add the account number.'
    else if (a && (a.length < 4 || a.length > 17 || a !== d.account.replace(/[\s-]/g, ''))) p.account = 'A US account number has 4 to 17 digits.'
    if (!d.account_type) p.account_type = 'Choose checking or savings.'
    if (!d.bank_name.trim()) p.bank_name = "Add the bank's name."
  } else {
    if (!acct && !keepsNumber) p.account = 'Add the IBAN or the account number.'
    else if (acct && looksLikeIban(acct) && !ibanValid(acct)) p.account = "This IBAN doesn't add up: check the characters."
    else if (acct && !looksLikeIban(acct) && !/^[A-Z0-9]{4,34}$/.test(acct)) p.account = 'Letters and digits only, 4 to 34 of them.'
    if (!swiftValid(compact(d.swift))) p.swift = "Add the bank's SWIFT/BIC code: 8 or 11 letters and digits."
    if (!d.country_code && !(acct && looksLikeIban(acct))) p.country_code = 'Choose the country the account is in.'
    if (!d.currency) p.currency = "Choose the account's currency."
    if (!d.bank_name.trim()) p.bank_name = "Add the bank's name."
  }
  return p
}

/**
 * Bank details (member profile step 5, 2026-10-23): where Virgilio pays a
 * person's commissions, on the Earnings tab. Reads first as rows with the
 * account number masked; admins and Billing reveal it for 30 seconds (written
 * to the person's history); the person and admins edit it, and a blank
 * number keeps the one on record.
 */
export function BankDetailsCard({
  tenantId,
  userId,
  self = false,
  name,
}: {
  tenantId: string | undefined
  userId: string | null
  /** My profile: the copy speaks to the person. */
  self?: boolean
  /** The person's first name, for the copy about them. */
  name?: string
}) {
  const bank = useBankDetails(tenantId, userId)
  const [editing, setEditing] = useState(false)
  const b = bank.data

  // No access at all: the card isn't there.
  if (bank.isSuccess && !b) return null

  const canEdit = !!b?.can_edit
  return (
    <ProfileCard
      title="Bank details"
      icon={Landmark}
      aside={b?.has_details && canEdit && !editing ? <EditToggle editing={false} onChange={setEditing} label="bank details" /> : undefined}
    >
      {bank.isLoading ? (
        <div className="space-y-2 py-1">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[22px] w-full" />
          ))}
        </div>
      ) : bank.isError ? (
        <LoadError what={self ? 'your bank details' : 'their bank details'} compact onRetry={() => void bank.refetch()} />
      ) : b && editing ? (
        <BankForm tenantId={tenantId!} userId={userId!} current={b} self={self} onDone={() => setEditing(false)} />
      ) : b && b.has_details ? (
        <BankRows tenantId={tenantId!} userId={userId!} b={b} self={self} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <p className="max-w-[460px] font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">
            {self
              ? 'Add the account Virgilio pays your commissions into. Only admins and Billing can see the full number.'
              : `No bank details yet. ${canEdit ? `Add them here, or ask ${name || 'them'} to add them in My profile.` : `${name || 'They'} can add them in My profile.`}`}
          </p>
          {canEdit && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing(true)}>
              Add bank details
            </Button>
          )}
        </div>
      )}
    </ProfileCard>
  )
}

function BankRows({ tenantId, userId, b, self }: { tenantId: string; userId: string; b: BankDetails; self: boolean }) {
  const qc = useQueryClient()
  const [shown, setShown] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)
  const [failed, setFailed] = useState(false)
  const timer = useRef<number | null>(null)

  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setShown(null)
  }
  // Masked again when the details change or the card goes away.
  useEffect(() => hide, [b.updated_at])

  const reveal = async () => {
    setRevealing(true)
    setFailed(false)
    try {
      const value = await revealBankAccount(tenantId, userId)
      setShown(value)
      timer.current = window.setTimeout(hide, REVEAL_MS)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    } catch {
      setFailed(true)
    } finally {
      setRevealing(false)
    }
  }

  const label = b.account_label ?? 'Account'
  const updated = b.updated_at
    ? `${new Date(b.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${b.updated_by_name ? ` by ${b.updated_by_name}` : ''}`
    : null

  return (
    <div>
      <InfoRows>
        <InfoRow label="Paid by">Bank transfer</InfoRow>
        <InfoRow label="Account holder">{b.holder_name}</InfoRow>
        <InfoRow label="Bank">
          {b.bank_name}
          {b.kind === 'intl' && b.country_code && <span className="text-[#6B7080]"> · {countryName(b.country_code)}</span>}
        </InfoRow>
        <InfoRow label={label}>
          <span className="inline-flex min-w-0 max-w-full items-center justify-end gap-1.5 tabular-nums">
            {shown ? (
              <CopyValue value={grouped(shown)} label={label} />
            ) : (
              <span className="whitespace-nowrap">•••• {b.account_last4}</span>
            )}
            {b.can_reveal && (
              <IconTip label={shown ? `Hide the ${label}` : `Reveal the ${label} for 30 seconds`}>
                <button
                  type="button"
                  aria-label={shown ? `Hide the ${label}` : `Reveal the ${label}`}
                  disabled={revealing}
                  onClick={() => (shown ? hide() : void reveal())}
                  className="gio-pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230] disabled:opacity-60"
                >
                  {revealing ? (
                    <span className="gio-spinner gio-spinner-current" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                  ) : shown ? (
                    <EyeOff size={13} />
                  ) : (
                    <Eye size={13} />
                  )}
                </button>
              </IconTip>
            )}
          </span>
        </InfoRow>
        {b.kind === 'us_account' && (
          <>
            <InfoRow label="Routing number">
              <CopyValue value={b.routing_number ?? ''} label="routing number" />
            </InfoRow>
            <InfoRow label="Account type">{b.account_type === 'savings' ? 'Savings' : 'Checking'}</InfoRow>
          </>
        )}
        {b.kind === 'intl' && b.swift && (
          <InfoRow label="SWIFT/BIC">
            <CopyValue value={b.swift} label="SWIFT/BIC code" />
          </InfoRow>
        )}
        <InfoRow label="Currency">{b.currency}</InfoRow>
      </InfoRows>
      {/* Reserved line: who changed it last, what a reveal means, or a failed reveal. */}
      <p className="mt-2 min-h-[18px] font-inter text-[11.5px] leading-[1.5] text-[#6B7080]" aria-live="polite">
        {failed ? (
          <span className="text-[#B91C1C]">
            Couldn't show the number ·{' '}
            <button type="button" onClick={() => void reveal()} className="font-medium underline underline-offset-2">
              Retry
            </button>
          </span>
        ) : shown ? (
          `Shown for 30 seconds. This view is in ${self ? 'your' : 'their'} history.`
        ) : self ? (
          `Only admins and Billing can see the full number. If anyone else changes these, you'll hear about it at once.${updated ? ` Updated ${updated}.` : ''}`
        ) : updated ? (
          `Updated ${updated}.`
        ) : null}
      </p>
    </div>
  )
}

function BankForm({
  tenantId,
  userId,
  current,
  self,
  onDone,
}: {
  tenantId: string
  userId: string
  current: BankDetails
  self: boolean
  onDone: () => void
}) {
  const save = useSaveBankDetails(tenantId, userId)
  const { user } = useAuth()
  // Changing your own details (here or in My profile) rings no one.
  const mine = self || user?.id === userId
  const [draft, setDraft] = useState<BankDraft>(() => fresh(current.kind ?? 'mx_clabe', current))
  const [tried, setTried] = useState(false)
  const [touched, setTouched] = useState<Partial<Record<keyof BankDraft, boolean>>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const segRef = useSegmentLayer<HTMLDivElement>()

  // A blank number keeps the one on record, but only for the same kind of account.
  const keepsNumber = current.has_details && current.kind === draft.kind
  const problems = problemsOf(draft, keepsNumber)
  const show = (k: keyof BankDraft) => (tried || touched[k] ? problems[k] : undefined)
  const set = (k: keyof BankDraft, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setServerError(null)
  }
  const blur = (k: keyof BankDraft) => setTouched((t) => ({ ...t, [k]: true }))
  const id = (k: string) => `bank-${userId}-${k}`

  const clabe = draft.kind === 'mx_clabe' ? digits(draft.account) : ''
  const clabeOk = clabe.length === 18 && clabeValid(clabe)
  const knownBank = clabe ? clabeBank(clabe) : null
  const acct = compact(draft.account)
  const ibanOk = draft.kind === 'intl' && looksLikeIban(acct) && ibanValid(acct)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(problems).length) {
      shakeFirstInvalid(formRef.current)
      return
    }
    // Nothing changed: close without a save, so no one is told about a change that didn't happen.
    const start = fresh(current.kind ?? 'mx_clabe', current)
    if (current.has_details && !draft.account.trim() && (Object.keys(start) as (keyof BankDraft)[]).every((k) => String(draft[k]).trim() === String(start[k]).trim())) {
      onDone()
      return
    }
    const payload: BankDraft = {
      ...draft,
      bank_name: draft.kind === 'mx_clabe' && !draft.bank_name.trim() ? knownBank ?? '' : draft.bank_name,
      country_code: draft.kind === 'intl' ? draft.country_code || (looksLikeIban(acct) ? acct.slice(0, 2) : '') : '',
    }
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(mine ? 'Your bank details are saved.' : 'Bank details saved. We let them know.')
        onDone()
      },
      onError: (err) => setServerError(bankErrorText(err, "Couldn't save the bank details. Try again.")),
    })
  }

  const accountLabel = draft.kind === 'mx_clabe' ? 'CLABE' : draft.kind === 'us_account' ? 'Account number' : 'IBAN or account number'
  const keepHint = keepsNumber ? `•••• ${current.account_last4} · leave blank to keep it` : undefined

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-3 py-1">
      <div>
        <p id={id('kind')} className="mb-1.5 font-inter text-[12.5px] font-medium text-virgilio-muted">
          Where is the account?
        </p>
        <div
          ref={segRef}
          role="radiogroup"
          aria-labelledby={id('kind')}
          className="gio-seg inline-flex max-w-full"
          style={{ gap: 2, padding: 3, background: '#ECEAE2', borderRadius: 9 }}
        >
          {KINDS.map((k) => {
            const active = draft.kind === k
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={active}
                data-seg-option
                data-active={active || undefined}
                onClick={() => {
                  if (active) return
                  setDraft({ ...fresh(k, current), holder_name: draft.holder_name })
                  setTouched({})
                  setTried(false)
                  setServerError(null)
                }}
                className="whitespace-nowrap font-inter"
                style={{
                  padding: '6px 12px',
                  borderRadius: 7,
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? '#fff' : '#5A6072',
                  background: 'transparent',
                  transition: 'color var(--dur-hover) ease',
                }}
              >
                {KIND_LABEL[k]}
              </button>
            )
          })}
          <SegmentLayer fill="#0d0d09" />
        </div>
      </div>

      <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
        <FormField label="Account holder" htmlFor={id('holder')} error={show('holder_name')} className="md:col-span-2">
          <Input
            id={id('holder')}
            autoComplete={self ? 'name' : 'off'}
            value={draft.holder_name}
            maxLength={140}
            onChange={(e) => set('holder_name', e.target.value)}
            onBlur={() => blur('holder_name')}
            placeholder="As it appears at the bank"
          />
        </FormField>

        {draft.kind === 'mx_clabe' && (
          <>
            <FormField
              label="CLABE"
              htmlFor={id('account')}
              error={show('account')}
              success={!show('account') && clabeOk ? (knownBank ? `${knownBank} · the digits add up` : 'The digits add up') : undefined}
              helpText={!show('account') && !clabeOk ? keepHint ?? '18 digits' : undefined}
            >
              <Input
                id={id('account')}
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
                value={draft.account}
                maxLength={24}
                onChange={(e) => set('account', e.target.value)}
                onBlur={() => blur('account')}
                placeholder={keepsNumber ? `•••• ${current.account_last4}` : '012 180 0012 3456 7899'}
              />
            </FormField>
            <FormField label="Bank" htmlFor={id('bank')} error={show('bank_name')}>
              <Input
                id={id('bank')}
                autoComplete="off"
                value={draft.bank_name}
                maxLength={120}
                onChange={(e) => set('bank_name', e.target.value)}
                onBlur={() => blur('bank_name')}
                placeholder={knownBank ?? 'Filled in from the CLABE'}
              />
            </FormField>
            <FormField label="Currency" htmlFor={id('currency')}>
              <SearchableSelect options={MX_CURRENCIES} value={draft.currency} onValueChange={(v) => set('currency', v || 'MXN')} />
            </FormField>
          </>
        )}

        {draft.kind === 'us_account' && (
          <>
            <FormField label="Bank" htmlFor={id('bank')} error={show('bank_name')}>
              <Input
                id={id('bank')}
                autoComplete="off"
                value={draft.bank_name}
                maxLength={120}
                onChange={(e) => set('bank_name', e.target.value)}
                onBlur={() => blur('bank_name')}
                placeholder="Chase, Wells Fargo…"
              />
            </FormField>
            <FormField label="Account type" htmlFor={id('type')} error={show('account_type')}>
              <SearchableSelect
                options={[
                  { value: 'checking', label: 'Checking' },
                  { value: 'savings', label: 'Savings' },
                ]}
                value={draft.account_type}
                onValueChange={(v) => {
                  set('account_type', v)
                  blur('account_type')
                }}
                placeholder="Checking or savings"
              />
            </FormField>
            <FormField
              label="Routing number"
              htmlFor={id('routing')}
              error={show('routing_number')}
              success={!show('routing_number') && abaValid(digits(draft.routing_number)) ? 'The digits add up' : undefined}
              helpText={!show('routing_number') && !abaValid(digits(draft.routing_number)) ? '9 digits (ABA)' : undefined}
            >
              <Input
                id={id('routing')}
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
                value={draft.routing_number}
                maxLength={11}
                onChange={(e) => set('routing_number', e.target.value)}
                onBlur={() => blur('routing_number')}
                placeholder="021000021"
              />
            </FormField>
            <FormField label="Account number" htmlFor={id('account')} error={show('account')} helpText={!show('account') ? keepHint ?? '4 to 17 digits' : undefined}>
              <Input
                id={id('account')}
                inputMode="numeric"
                autoComplete="off"
                className="tabular-nums"
                value={draft.account}
                maxLength={20}
                onChange={(e) => set('account', e.target.value)}
                onBlur={() => blur('account')}
                placeholder={keepsNumber ? `•••• ${current.account_last4}` : undefined}
              />
            </FormField>
            <FormField label="Currency" htmlFor={id('currency')}>
              <Input id={id('currency')} value="USD" readOnly disabled />
            </FormField>
          </>
        )}

        {draft.kind === 'intl' && (
          <>
            <FormField label="Country" htmlFor={id('country')} error={show('country_code')}>
              <SearchableSelect
                options={COUNTRIES}
                value={draft.country_code || (ibanOk ? acct.slice(0, 2) : '')}
                onValueChange={(v) => {
                  set('country_code', v)
                  blur('country_code')
                }}
                placeholder="Choose a country"
                searchPlaceholder="Search countries…"
                emptyMessage="No country by that name."
              />
            </FormField>
            <FormField label="Bank" htmlFor={id('bank')} error={show('bank_name')}>
              <Input
                id={id('bank')}
                autoComplete="off"
                value={draft.bank_name}
                maxLength={120}
                onChange={(e) => set('bank_name', e.target.value)}
                onBlur={() => blur('bank_name')}
              />
            </FormField>
            <FormField
              label={accountLabel}
              htmlFor={id('account')}
              error={show('account')}
              success={!show('account') && ibanOk ? 'The IBAN adds up' : undefined}
              helpText={!show('account') && !ibanOk ? keepHint ?? 'An IBAN where the country uses them' : undefined}
              className="md:col-span-2"
            >
              <Input
                id={id('account')}
                autoComplete="off"
                autoCapitalize="characters"
                className="tabular-nums"
                value={draft.account}
                maxLength={44}
                onChange={(e) => set('account', e.target.value)}
                onBlur={() => blur('account')}
                placeholder={keepsNumber ? `•••• ${current.account_last4}` : 'DE89 3704 0044 0532 0130 00'}
              />
            </FormField>
            <FormField label="SWIFT/BIC" htmlFor={id('swift')} error={show('swift')}>
              <Input
                id={id('swift')}
                autoComplete="off"
                autoCapitalize="characters"
                value={draft.swift}
                maxLength={14}
                onChange={(e) => set('swift', e.target.value)}
                onBlur={() => blur('swift')}
                placeholder="COBADEFFXXX"
              />
            </FormField>
            <FormField label="Currency" htmlFor={id('currency')} error={show('currency')}>
              <SearchableSelect
                options={CURRENCIES}
                value={draft.currency}
                onValueChange={(v) => {
                  set('currency', v)
                  blur('currency')
                }}
                placeholder="Choose a currency"
                searchPlaceholder="Search currencies…"
                emptyMessage="Not in the list."
              />
            </FormField>
          </>
        )}
      </div>

      {/* Reserved line for what the database said, then the actions. */}
      <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={serverError ? 'alert' : undefined}>
        {serverError}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter text-[11.5px] text-[#6B7080]">
          {mine
            ? 'Only admins and Billing will see the full number.'
            : 'Saving tells them by email and in their notifications.'}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={save.isPending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={save.isPending}>
            Save bank details
          </Button>
        </div>
      </div>
    </form>
  )
}
