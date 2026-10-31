import { useEffect, useRef, useState } from 'react'
import { ReceiptText } from 'lucide-react'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { CityPicker, CountryPicker, RegionPicker } from '@/components/ui/place-picker'
import { LoadError } from '@/components/empty/LoadError'
import { EditToggle, InfoRow, InfoRows, ProfileCard } from '@/components/os/ProfileParts'
import { motionToken } from '@/lib/motion'
import { placeChange } from '@/lib/places'
import { useShipping } from '@/lib/os/shipping'
import { EMPTY_TAX_ADDRESS, taxAddressLines, useSaveTaxAddress, useTaxAddress, type TaxAddress } from '@/lib/os/taxAddress'

/**
 * Tax address (Allan, 2026-10-31): the address printed on the person's
 * invoices to Virgilio Technologies LLC for their commissions. "Same as
 * shipping address" is on by default; turned off, the card holds an address
 * of its own (autosaving form, §12). The person and People & Access admins
 * only; never for external users.
 */
export function TaxAddressCard({ tenantId, userId, self, name }: { tenantId: string; userId: string; self: boolean; name?: string }) {
  const tax = useTaxAddress(tenantId, userId)
  const shipping = useShipping(tenantId, userId)
  const save = useSaveTaxAddress(tenantId, userId)
  const [editing, setEditing] = useState(false)
  const [switchError, setSwitchError] = useState(false)
  const a = tax.data ?? EMPTY_TAX_ADDRESS
  const same = a.same_as_shipping
  // The invoice prints the person's own name above the address, so no recipient line here.
  const shown = same ? taxAddressLines(shipping.data) : taxAddressLines(a)
  const who = self ? 'you' : name || 'they'
  const loading = tax.isLoading || (same && shipping.isLoading)

  const setSame = (on: boolean) => {
    setSwitchError(false)
    save.mutate(on ? { ...EMPTY_TAX_ADDRESS, same_as_shipping: true } : { ...a, same_as_shipping: false }, {
      onError: () => setSwitchError(true),
    })
    if (!on && !taxAddressLines(a).length) setEditing(true)
    if (on) setEditing(false)
  }

  return (
    <ProfileCard
      id="card-tax-address"
      title="Tax address"
      icon={ReceiptText}
      tone="blue"
      aside={tax.isSuccess && !same ? <EditToggle editing={editing} onChange={setEditing} label="tax address" /> : undefined}
    >
      {tax.isError ? (
        <LoadError what={self ? 'your tax address' : 'their tax address'} compact onRetry={() => void tax.refetch()} />
      ) : (
        <>
          <div className="mb-1.5 flex min-h-[44px] items-center justify-between gap-4 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5">
            <label htmlFor={`tax-same-${userId}`} className="min-w-0 font-inter text-[12.5px] text-[#1F2230]">
              Same as shipping address
            </label>
            {tax.isLoading ? (
              <Skeleton className="h-6 w-11 rounded-full" />
            ) : (
              <Switch id={`tax-same-${userId}`} checked={same} onCheckedChange={setSame} />
            )}
          </div>
          {editing && !same ? (
            <TaxAddressForm tenantId={tenantId} userId={userId} self={self} />
          ) : loading ? (
            <Skeleton className="h-[92px] w-full rounded-[10px]" />
          ) : (
            <InfoRows>
              <InfoRow
                label="On invoices"
                stack={shown.length > 0}
                empty={
                  same
                    ? self
                      ? 'Add a shipping address, or turn this off and add one here'
                      : 'No shipping address yet'
                    : self
                      ? 'Add the address for your invoices'
                      : 'Not set'
                }
              >
                {shown.length ? (
                  <span className="block text-left leading-[1.55]">
                    {shown.map((l, i) => (
                      <span key={i} className="block break-words">
                        {l}
                      </span>
                    ))}
                  </span>
                ) : null}
              </InfoRow>
            </InfoRows>
          )}
          <p className="min-h-[18px] pt-1 font-inter text-[11.5px] text-[#B91C1C]" role="alert">
            {switchError ? "Couldn't save the switch. Try again." : null}
          </p>
        </>
      )}
      <p className="font-inter text-[11.5px] text-[#6B7080]">
        Printed on {self ? 'your' : 'their'} commission invoices to Virgilio Technologies LLC. Only People &amp; Access admins and {who} see it.
      </p>
    </ProfileCard>
  )
}

type Field = 'line1' | 'line2' | 'city' | 'region' | 'postal_code' | 'country_code'
type Draft = Record<Field, string>
const FIELDS: Field[] = ['line1', 'line2', 'city', 'region', 'postal_code', 'country_code']
const toDraft = (a: TaxAddress | null): Draft => Object.fromEntries(FIELDS.map((k) => [k, a?.[k] ?? ''])) as Draft
const toAddress = (d: Draft): TaxAddress => ({
  same_as_shipping: false,
  ...(Object.fromEntries(FIELDS.map((k) => [k, d[k].trim() || null])) as Record<Field, string | null>),
})
const equal = (a: TaxAddress, b: TaxAddress) => FIELDS.every((k) => (a[k] ?? null) === (b[k] ?? null)) && a.same_as_shipping === b.same_as_shipping

type SaveState = 'idle' | 'saving' | 'saved' | 'savedAgo' | 'error'

function TaxAddressForm({ tenantId, userId, self }: { tenantId: string; userId: string; self: boolean }) {
  const tax = useTaxAddress(tenantId, userId)
  const save = useSaveTaxAddress(tenantId, userId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<number | null>(null)
  const agoTimer = useRef<number | null>(null)
  const lastSaved = useRef<TaxAddress | null>(null)

  useEffect(() => {
    if (tax.isSuccess && draft === null) {
      setDraft(toDraft(tax.data))
      lastSaved.current = tax.data ? { ...tax.data, same_as_shipping: false } : { ...EMPTY_TAX_ADDRESS, same_as_shipping: false }
    }
  }, [tax.isSuccess, tax.data, draft])
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
      if (agoTimer.current) window.clearTimeout(agoTimer.current)
    },
    [],
  )

  const flush = (next: Draft) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    const value = toAddress(next)
    if (lastSaved.current && equal(value, lastSaved.current)) return
    setState('saving')
    save.mutate(value, {
      onSuccess: (saved) => {
        lastSaved.current = saved
        setState('saved')
        if (agoTimer.current) window.clearTimeout(agoTimer.current)
        agoTimer.current = window.setTimeout(() => setState((s) => (s === 'saved' ? 'savedAgo' : s)), 2000)
      },
      onError: () => setState('error'),
    })
  }
  const change = (k: Field, value: string) => {
    if (!draft) return
    const next = { ...draft, [k]: value }
    setDraft(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(next), motionToken('--delay-autosave', 600))
  }
  const place = (k: 'country' | 'region' | 'city', value: string, regionOfCity?: string) => {
    if (!draft) return
    const p = placeChange({ country: draft.country_code, region: draft.region, city: draft.city }, k, value, regionOfCity)
    const next = { ...draft, country_code: p.country, region: p.region, city: p.city }
    setDraft(next)
    flush(next)
  }

  if (!draft) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] w-full rounded-[8px]" />
        ))}
      </div>
    )
  }
  const id = (k: string) => `tax-${userId}-${k}`
  const status = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'savedAgo' ? 'Saved just now' : null

  return (
    <div className="pt-1.5">
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Country" htmlFor={id('country')}>
          <CountryPicker id={id('country')} value={draft.country_code} onChange={(v) => place('country', v)} placeholder="Not set" />
        </FormField>
        <FormField label="State or province" htmlFor={id('region')}>
          <RegionPicker id={id('region')} countryCode={draft.country_code} value={draft.region} onChange={(v) => place('region', v)} placeholder="Not set" />
        </FormField>
        <FormField label="City" htmlFor={id('city')}>
          <CityPicker
            id={id('city')}
            countryCode={draft.country_code}
            regionName={draft.region}
            value={draft.city}
            onChange={(v, r) => place('city', v, r)}
            placeholder="Not set"
          />
        </FormField>
        <FormField label="Postal code" htmlFor={id('postal')}>
          <Input
            id={id('postal')}
            autoComplete={self ? 'postal-code' : 'off'}
            value={draft.postal_code}
            maxLength={20}
            onChange={(e) => change('postal_code', e.target.value)}
            onBlur={() => flush(draft)}
          />
        </FormField>
        <FormField label="Street and number" htmlFor={id('line1')} className="md:col-span-2">
          <Input
            id={id('line1')}
            autoComplete={self ? 'address-line1' : 'off'}
            value={draft.line1}
            maxLength={200}
            placeholder="Av. Vasconcelos 150, Col. Del Valle"
            onChange={(e) => change('line1', e.target.value)}
            onBlur={() => flush(draft)}
          />
        </FormField>
        <FormField label="Apartment, suite or floor" htmlFor={id('line2')} className="md:col-span-2">
          <Input
            id={id('line2')}
            autoComplete={self ? 'address-line2' : 'off'}
            value={draft.line2}
            maxLength={200}
            onChange={(e) => change('line2', e.target.value)}
            onBlur={() => flush(draft)}
          />
        </FormField>
      </div>
      <div className="mt-2 flex min-h-[18px] items-center justify-end font-inter text-[11.5px]" aria-live="polite">
        {state === 'error' ? (
          <span className="gio-autosave-label text-[#B91C1C]">
            Couldn't save ·{' '}
            <button
              type="button"
              onClick={() => flush(draft)}
              className="font-medium underline underline-offset-2 transition-colors duration-hover hover:text-text-primary"
            >
              Retry
            </button>
          </span>
        ) : status ? (
          <span key={status} className="gio-autosave-label text-[#8B8F9E]">
            {status}
          </span>
        ) : null}
      </div>
    </div>
  )
}
