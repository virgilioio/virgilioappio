import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, IdCard, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { LoadError } from '@/components/empty/LoadError'
import { CopyValue, InfoRow, InfoRows, ProfileCard } from '@/components/os/ProfileParts'
import { useAuth } from '@/contexts/AuthContext'
import { COUNTRIES } from '@/constants/countries'
import { shakeFirstInvalid } from '@/lib/motion'
import { usePersonDetails } from '@/lib/os/peopleAccess'
import {
  normalTaxId,
  revealTaxId,
  taxIdErrorText,
  taxIdProblem,
  useRemoveTaxId,
  useSaveTaxId,
  useTaxIdTypes,
  useTaxIds,
  type TaxIdRow,
  type TaxIdType,
} from '@/lib/os/taxIds'

const REVEAL_MS = 30_000
const OTHER = 'other'
const countryName = (code: string | null) => (code ? COUNTRIES.find((c) => c.value === code)?.label ?? code : 'Another country')

/**
 * Tax IDs (member profile part 2, 2026-10-24), beside Bank details on the
 * profile's Overview. Reads first as rows with each ID masked to its last four;
 * admins and Billing reveal one for 30 seconds (written to the person's
 * history); the person and admins add, change and remove them. The form takes
 * the country first (the person's own when it's set), then the kind of ID,
 * and checks the format and check digit as the database will.
 */
export function TaxIdsCard({
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
  const ids = useTaxIds(tenantId, userId)
  const types = useTaxIdTypes()
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const d = ids.data

  // No access at all: the card isn't there.
  if (ids.isSuccess && !d) return null

  const canEdit = !!d?.can_edit
  const rows = d?.ids ?? []
  const loading = ids.isLoading || types.isLoading
  const typeOf = (key: string) => types.data?.find((t) => t.key === key)
  const free = (types.data ?? []).filter((t) => !rows.some((r) => r.type_key === t.key))

  return (
    <ProfileCard
      id="card-tax-ids"
      title="Tax IDs"
      icon={IdCard}
      tone="blue"
      aside={
        canEdit && rows.length > 0 && !editing && free.length > 0 ? (
          <Button variant="ghost" size="sm" icon={Plus} className="bg-[#F1F0EC]" onClick={() => setEditing('new')}>
            Add
          </Button>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[44px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : ids.isError || types.isError ? (
        <LoadError
          what={self ? 'your tax IDs' : 'their tax IDs'}
          compact
          onRetry={() => {
            void ids.refetch()
            void types.refetch()
          }}
        />
      ) : editing ? (
        <TaxIdForm
          tenantId={tenantId!}
          userId={userId!}
          self={self}
          types={editing === 'new' ? free : (types.data ?? []).filter((t) => t.key === editing)}
          current={editing === 'new' ? null : rows.find((r) => r.type_key === editing) ?? null}
          onDone={() => setEditing(null)}
        />
      ) : rows.length > 0 ? (
        <TaxIdRows
          tenantId={tenantId!}
          userId={userId!}
          rows={rows}
          canEdit={canEdit}
          canReveal={!!d?.can_reveal}
          self={self}
          noteOf={(r) => typeOf(r.type_key)?.note ?? null}
          onEdit={setEditing}
        />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <p className="max-w-[460px] font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">
            {self
              ? 'Add your tax ID, so Virgilio can pay your commissions and keep the paperwork right. Only admins and Billing can see the full number.'
              : `No tax IDs yet. ${canEdit ? `Add one here, or ask ${name || 'them'} to add it in My profile.` : `${name || 'They'} can add one in My profile.`}`}
          </p>
          {canEdit && (
            <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing('new')}>
              Add tax ID
            </Button>
          )}
        </div>
      )}
    </ProfileCard>
  )
}

function TaxIdRows({
  tenantId,
  userId,
  rows,
  canEdit,
  canReveal,
  self,
  noteOf,
  onEdit,
}: {
  tenantId: string
  userId: string
  rows: TaxIdRow[]
  canEdit: boolean
  canReveal: boolean
  self: boolean
  noteOf: (r: TaxIdRow) => string | null
  onEdit: (typeKey: string) => void
}) {
  const qc = useQueryClient()
  const remove = useRemoveTaxId(tenantId, userId)
  const { user } = useAuth()
  const mine = self || user?.id === userId
  const [shown, setShown] = useState<{ key: string; value: string } | null>(null)
  const [revealing, setRevealing] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setShown(null)
  }
  // Masked again when the list changes or the card goes away.
  const stamp = rows.map((r) => r.updated_at).join()
  useEffect(() => hide, [stamp])

  const reveal = async (key: string) => {
    hide()
    setRevealing(key)
    setFailed(null)
    try {
      const value = await revealTaxId(tenantId, userId, key)
      setShown({ key, value })
      timer.current = window.setTimeout(hide, REVEAL_MS)
      void qc.invalidateQueries({ queryKey: ['os-audit', tenantId] })
    } catch {
      setFailed(key)
    } finally {
      setRevealing(null)
    }
  }

  const askRemove = async (r: TaxIdRow) => {
    const ok = await confirmDestructive({
      variant: 'remove',
      title: `Remove ${mine ? 'your' : 'their'} ${r.label}?`,
      description: mine
        ? `The ${r.label} ending ${r.last4} is erased from your profile. You can add it again at any time.`
        : `The ${r.label} ending ${r.last4} is erased from their profile, and they're told by email and in their notifications. Their history keeps a note that it was removed, never the number.`,
      confirmLabel: `Remove ${r.label}`,
    })
    if (!ok) return
    remove.mutate(r.type_key, {
      onSuccess: () => toast.success(`${r.label} removed.`),
      onError: (err) => toast.error(taxIdErrorText(err, `Couldn't remove the ${r.label}. Try again.`)),
    })
  }

  const latest = rows.reduce<TaxIdRow | null>((a, r) => (!a || r.updated_at > a.updated_at ? r : a), null)
  const updated = latest
    ? `${new Date(latest.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${latest.updated_by_name ? ` by ${latest.updated_by_name}` : ''}`
    : null
  const failedRow = rows.find((r) => r.type_key === failed)

  return (
    <div>
      <InfoRows>
        {rows.map((r) => {
          const open = shown?.key === r.type_key
          return (
            <InfoRow key={r.type_key} label={r.label} hint={[countryName(r.country_code), noteOf(r)].filter(Boolean).join(' · ')}>
              <span className="inline-flex min-w-0 max-w-full items-center justify-end gap-1.5 tabular-nums">
                {open ? <CopyValue value={shown.value} label={r.label} /> : <span className="whitespace-nowrap">•••• {r.last4}</span>}
                {canReveal && (
                  <IconTip label={open ? `Hide the ${r.label}` : `Reveal the ${r.label} for 30 seconds`}>
                    <button
                      type="button"
                      aria-label={open ? `Hide the ${r.label}` : `Reveal the ${r.label}`}
                      disabled={revealing === r.type_key}
                      onClick={() => (open ? hide() : void reveal(r.type_key))}
                      className="gio-pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230] disabled:opacity-60"
                    >
                      {revealing === r.type_key ? (
                        <span className="gio-spinner gio-spinner-current" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                      ) : open ? (
                        <EyeOff size={13} />
                      ) : (
                        <Eye size={13} />
                      )}
                    </button>
                  </IconTip>
                )}
                {canEdit && (
                  <DropdownMenu>
                    <IconTip label={`${r.label} actions`}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`${r.label} actions`}
                          className="gio-pressable inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#6B7080] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230]"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </DropdownMenuTrigger>
                    </IconTip>
                    <DropdownMenuContent align="end" className="w-[272px]">
                      <DropdownMenuItem onSelect={() => onEdit(r.type_key)}>
                        <Pencil />
                        <span className="truncate">Change the {r.label}</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem data-danger onSelect={() => void askRemove(r)}>
                        <Trash2 />
                        <span className="truncate">Remove</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </span>
            </InfoRow>
          )
        })}
      </InfoRows>
      {/* Reserved line: who changed them last, what a reveal means, or a failed reveal. */}
      <p className="mt-2 min-h-[18px] font-inter text-[11.5px] leading-[1.5] text-[#6B7080]" aria-live="polite">
        {failedRow ? (
          <span className="text-[#B91C1C]">
            Couldn't show the {failedRow.label} ·{' '}
            <button type="button" onClick={() => void reveal(failedRow.type_key)} className="font-medium underline underline-offset-2">
              Retry
            </button>
          </span>
        ) : shown ? (
          `Shown for 30 seconds. This view is in ${self ? 'your' : 'their'} history.`
        ) : self ? (
          `Only admins and Billing can see the full numbers. If anyone else changes them, you'll hear about it at once.${updated ? ` Updated ${updated}.` : ''}`
        ) : updated ? (
          `Updated ${updated}.`
        ) : null}
      </p>
    </div>
  )
}

function TaxIdForm({
  tenantId,
  userId,
  self,
  types,
  current,
  onDone,
}: {
  tenantId: string
  userId: string
  self: boolean
  /** The kinds that can be chosen: every kind not on file yet, or the one being changed. */
  types: TaxIdType[]
  current: TaxIdRow | null
  onDone: () => void
}) {
  const save = useSaveTaxId(tenantId, userId)
  const details = usePersonDetails(tenantId, userId)
  const { user } = useAuth()
  // Changing your own tax IDs (here or in My profile) rings no one.
  const mine = self || user?.id === userId
  const formRef = useRef<HTMLFormElement>(null)
  const uid = `taxid-${userId}`

  // Countries in the catalogue, the person's own first; anything else is "Another country".
  const countries = useMemo(() => {
    const codes = [...new Set(types.map((t) => t.country_code ?? OTHER))]
    return codes
      .map((c) => ({ value: c, label: c === OTHER ? 'Another country' : countryName(c) }))
      .sort((a, b) => (a.value === OTHER ? 1 : b.value === OTHER ? -1 : a.label.localeCompare(b.label)))
  }, [types])
  const home = details.data?.country_code ?? null
  const startCountry = current
    ? current.country_code ?? OTHER
    : home && countries.some((c) => c.value === home)
      ? home
      : countries.length === 1
        ? countries[0].value
        : ''

  const [country, setCountry] = useState(startCountry)
  // The person's country arrives after the form opens: take it if nothing was picked yet.
  useEffect(() => {
    if (!country && startCountry) setCountry(startCountry)
  }, [startCountry]) // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = types.filter((t) => (t.country_code ?? OTHER) === country)
  const [typeKey, setTypeKey] = useState(current?.type_key ?? '')
  const type = types.find((t) => t.key === typeKey) ?? (kinds.length === 1 ? kinds[0] : null)
  const [value, setValue] = useState('')
  const [touched, setTouched] = useState(false)
  const [tried, setTried] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const problem = type ? taxIdProblem(type, value) : null
  const showProblem = (tried || touched) && value.trim() ? problem : tried ? problem : null
  const passes = !!type && !!value.trim() && !problem

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!country || !type || problem) {
      shakeFirstInvalid(formRef.current)
      return
    }
    save.mutate(
      { typeKey: type.key, value: normalTaxId(value) },
      {
        onSuccess: () => {
          toast.success(mine ? `Your ${type.label} is saved.` : `${type.label} saved. We let them know.`)
          onDone()
        },
        onError: (err) => setServerError(taxIdErrorText(err, `Couldn't save the ${type.label}. Try again.`)),
      },
    )
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-3 py-1">
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
        <FormField label="Country" htmlFor={`${uid}-country`} error={tried && !country ? 'Choose the country that issued it.' : undefined}>
          {current ? (
            <Input id={`${uid}-country`} value={countryName(current.country_code)} readOnly disabled />
          ) : (
            <SearchableSelect
              options={countries}
              value={country}
              onValueChange={(v) => {
                setCountry(v)
                setTypeKey('')
                setServerError(null)
              }}
              placeholder="Choose a country"
              searchPlaceholder="Search countries…"
              emptyMessage="Not in the list: choose Another country."
            />
          )}
        </FormField>
        <FormField label="Kind" htmlFor={`${uid}-kind`} error={tried && country && !type ? 'Choose which ID this is.' : undefined}>
          {current || kinds.length === 1 ? (
            <Input id={`${uid}-kind`} value={type?.label ?? ''} readOnly disabled />
          ) : (
            <SearchableSelect
              options={kinds.map((t) => ({ value: t.key, label: t.label, hint: t.holder === 'company' ? 'Company' : undefined }))}
              value={type?.key ?? ''}
              onValueChange={(v) => {
                setTypeKey(v)
                setServerError(null)
              }}
              placeholder={country ? 'Choose one' : 'Choose a country first'}
              disabled={!country}
            />
          )}
        </FormField>
        <FormField
          label={type?.label ?? 'Number'}
          htmlFor={`${uid}-value`}
          error={showProblem ?? undefined}
          success={!showProblem && passes ? (type!.check_rule === 'none' ? 'The format is right' : 'The check digit adds up') : undefined}
          helpText={
            !showProblem && !passes
              ? current
                ? `•••• ${current.last4} on file · type the new one`
                : type
                  ? `For example ${type.example}${type.note ? ` · ${type.note}` : ''}`
                  : undefined
              : undefined
          }
          className="md:col-span-2"
        >
          <Input
            id={`${uid}-value`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="tabular-nums"
            value={value}
            maxLength={40}
            disabled={!type}
            aria-invalid={!!showProblem || undefined}
            onChange={(e) => {
              setValue(e.target.value)
              setServerError(null)
            }}
            onBlur={() => setTouched(true)}
            placeholder={current ? `•••• ${current.last4}` : type?.example}
          />
        </FormField>
      </div>

      {/* Reserved line for what the database said, then the actions. */}
      <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={serverError ? 'alert' : undefined}>
        {serverError}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-inter text-[11.5px] text-[#6B7080]">
          {mine ? 'Only admins and Billing will see the full number.' : 'Saving tells them by email and in their notifications.'}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={save.isPending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={save.isPending}>
            Save {type?.label ?? 'tax ID'}
          </Button>
        </div>
      </div>
    </form>
  )
}
