import { useEffect, useRef, useState } from 'react'
import { Check, Copy, House, Package } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { IconSwap } from '@/components/ui/icon-swap'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { IconTip } from '@/components/ui/tooltip'
import { CityPicker, CountryPicker, RegionPicker } from '@/components/ui/place-picker'
import { placeChange } from '@/lib/places'
import { LoadError } from '@/components/empty/LoadError'
import { EditToggle, InfoRow, InfoRows, ProfileCard } from '@/components/os/ProfileParts'
import { motionToken } from '@/lib/motion'
import { PERSONAL_PHONE_RE, usePersonDetails } from '@/lib/os/peopleAccess'
import { EMPTY_SHIPPING, shippingLines, useSaveShipping, useShipping, type ShippingAddress } from '@/lib/os/shipping'
import { copyToClipboardSilent } from '@/utils/clipboard'

/**
 * Shipping address (Allan, 2026-10-26): where Virgilio sends a person swag or
 * mail. Beside Personal on the profile's Overview: reads as the address on a
 * parcel with Copy address, and Edit opens the autosaving form (§12), which
 * can start from where the person lives. The person and People & Access
 * admins only; never for external users.
 */
export function ShippingAddressCard({
  tenantId,
  userId,
  self,
  name,
  fullName,
}: {
  tenantId: string
  userId: string
  self: boolean
  /** First name, for the copy about them. */
  name?: string
  /** Who the parcel is for when no recipient is set. */
  fullName?: string
}) {
  const shipping = useShipping(tenantId, userId)
  const [editing, setEditing] = useState(false)
  const a = shipping.data
  const lines = shippingLines(a, fullName)
  const hasAddress = !!(a?.line1 || a?.city)
  const who = self ? 'you' : name || 'they'

  return (
    <ProfileCard
      id="card-shipping"
      title="Shipping address"
      icon={Package}
      tone="yellow"
      aside={
        shipping.isSuccess ? (
          <div className="flex items-center gap-1.5">
            {!editing && hasAddress && <CopyAddress text={[...lines, a?.phone ?? ''].filter(Boolean).join('\n')} />}
            <EditToggle editing={editing} onChange={setEditing} label="shipping address" />
          </div>
        ) : undefined
      }
    >
      {editing ? (
        <ShippingAddressForm tenantId={tenantId} userId={userId} self={self} fullName={fullName} />
      ) : shipping.isError ? (
        <LoadError what={self ? 'your shipping address' : 'their shipping address'} compact onRetry={() => void shipping.refetch()} />
      ) : shipping.isLoading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-[92px] w-full rounded-[10px]" />
          <Skeleton className="h-[44px] w-full rounded-[10px]" />
        </div>
      ) : !hasAddress ? (
        <InfoRows>
          <InfoRow label="Ship to" empty={self ? 'Add where Virgilio can send you things' : 'Not set'} />
        </InfoRows>
      ) : (
        <InfoRows>
          <InfoRow label="Ship to" stack>
            <span className="block text-left leading-[1.55]">
              {lines.map((l, i) => (
                <span key={i} className="block break-words">
                  {l}
                </span>
              ))}
            </span>
          </InfoRow>
          <InfoRow label="Phone for the courier">{a?.phone}</InfoRow>
          {a?.notes && (
            <InfoRow label="Delivery notes" stack>
              <span className="block whitespace-pre-line break-words text-left font-normal">{a.notes}</span>
            </InfoRow>
          )}
        </InfoRows>
      )}
      <p className="pt-3 font-inter text-[11.5px] text-[#6B7080]">
        For swag and mail from Virgilio. Only People &amp; Access admins and {who} see it.
      </p>
    </ProfileCard>
  )
}

/** Copy address: the icon swaps to a tick for 1.6s (§7 copy chips). */
function CopyAddress({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <IconTip label={copied ? 'Copied' : 'Copy address'}>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        aria-label="Copy address"
        className="bg-[#F1F0EC]"
        onClick={async () => {
          if (await copyToClipboardSilent(text)) {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
          }
        }}
      >
        <IconSwap swapped={copied} from={<Copy size={14} />} to={<Check size={14} />} />
      </Button>
    </IconTip>
  )
}

type Draft = Record<keyof ShippingAddress, string>
const toDraft = (a: ShippingAddress | null): Draft =>
  Object.fromEntries((Object.keys(EMPTY_SHIPPING) as (keyof ShippingAddress)[]).map((k) => [k, a?.[k] ?? ''])) as Draft
const toAddress = (d: Draft): ShippingAddress =>
  Object.fromEntries((Object.keys(EMPTY_SHIPPING) as (keyof ShippingAddress)[]).map((k) => [k, d[k].trim() || null])) as unknown as ShippingAddress
const same = (a: ShippingAddress, b: ShippingAddress) =>
  (Object.keys(EMPTY_SHIPPING) as (keyof ShippingAddress)[]).every((k) => (a[k] ?? null) === (b[k] ?? null))

const problems = (d: Draft) => ({
  phone: d.phone.trim() && !PERSONAL_PHONE_RE.test(d.phone.trim()) ? 'Use digits, spaces, ( ) - and an optional + at the start.' : undefined,
})

type SaveState = 'idle' | 'saving' | 'saved' | 'savedAgo' | 'error'

function ShippingAddressForm({ tenantId, userId, self, fullName }: { tenantId: string; userId: string; self: boolean; fullName?: string }) {
  const shipping = useShipping(tenantId, userId)
  const home = usePersonDetails(tenantId, userId)
  const save = useSaveShipping(tenantId, userId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof ShippingAddress, boolean>>>({})
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<number | null>(null)
  const agoTimer = useRef<number | null>(null)
  const lastSaved = useRef<ShippingAddress | null>(null)

  useEffect(() => {
    if (shipping.isSuccess && draft === null) {
      setDraft(toDraft(shipping.data))
      lastSaved.current = shipping.data ?? EMPTY_SHIPPING
    }
  }, [shipping.isSuccess, shipping.data, draft])
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
    if (problems(next).phone) return
    const value = toAddress(next)
    if (lastSaved.current && same(value, lastSaved.current)) return
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
  const change = (key: keyof ShippingAddress, value: string) => {
    if (!draft) return
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(next), motionToken('--delay-autosave', 600))
  }
  const blur = (key: keyof ShippingAddress) => {
    setTouched((t) => ({ ...t, [key]: true }))
    if (draft) flush(draft)
  }
  const place = (key: 'country' | 'region' | 'city', value: string, regionOfCity?: string) => {
    if (!draft) return
    const p = placeChange({ country: draft.country_code, region: draft.region, city: draft.city }, key, value, regionOfCity)
    const next = { ...draft, country_code: p.country, region: p.region, city: p.city }
    setDraft(next)
    flush(next)
  }

  if (shipping.isError) return <LoadError what="the shipping address" compact onRetry={() => void shipping.refetch()} />
  if (!draft) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] w-full rounded-[8px]" />
        ))}
      </div>
    )
  }

  const h = home.data
  const canCopyHome = !!h?.country_code
  const homeSame = canCopyHome && h?.country_code === draft.country_code && (h?.region ?? '') === draft.region && (h?.city ?? '') === draft.city
  const p = problems(draft)
  const id = (k: string) => `ship-${userId}-${k}`
  const status = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'savedAgo' ? 'Saved just now' : null

  return (
    <div>
      {canCopyHome && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5">
          <span className="min-w-0 font-inter text-[12.5px] text-[#5A6072]">
            {self ? 'You live in' : 'Lives in'} {[h?.city, h?.region].filter(Boolean).join(', ') || 'a country on record'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            icon={homeSame ? Check : House}
            disabled={homeSame}
            onClick={() => {
              const next = { ...draft, country_code: h?.country_code ?? '', region: h?.region ?? '', city: h?.city ?? '' }
              setDraft(next)
              flush(next)
            }}
          >
            Same as where I live
          </Button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Recipient" htmlFor={id('recipient')} helpText={fullName ? `Leave it blank to use ${fullName}.` : undefined}>
          <Input
            id={id('recipient')}
            autoComplete={self ? 'name' : 'off'}
            value={draft.recipient_name}
            maxLength={120}
            placeholder={fullName}
            onChange={(e) => change('recipient_name', e.target.value)}
            onBlur={() => blur('recipient_name')}
          />
        </FormField>
        <FormField label="Phone for the courier" htmlFor={id('phone')} error={touched.phone ? p.phone : undefined}>
          <Input
            id={id('phone')}
            type="tel"
            inputMode="tel"
            autoComplete={self ? 'tel' : 'off'}
            value={draft.phone}
            aria-invalid={touched.phone && !!p.phone}
            placeholder="+52 55 1234 5678"
            onChange={(e) => change('phone', e.target.value)}
            onBlur={() => blur('phone')}
          />
        </FormField>
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
            onBlur={() => blur('postal_code')}
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
            onBlur={() => blur('line1')}
          />
        </FormField>
        <FormField label="Apartment, suite or floor" htmlFor={id('line2')} className="md:col-span-2">
          <Input
            id={id('line2')}
            autoComplete={self ? 'address-line2' : 'off'}
            value={draft.line2}
            maxLength={200}
            onChange={(e) => change('line2', e.target.value)}
            onBlur={() => blur('line2')}
          />
        </FormField>
        <FormField label="Delivery notes" htmlFor={id('notes')} className="md:col-span-2">
          <Textarea
            id={id('notes')}
            value={draft.notes}
            maxLength={300}
            rows={2}
            placeholder="Gate code, a neighbour who can sign, the best time to deliver"
            onChange={(e) => change('notes', e.target.value)}
            onBlur={() => blur('notes')}
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
