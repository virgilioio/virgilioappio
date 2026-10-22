import { useEffect, useRef, useState } from 'react'

import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/empty/LoadError'
import { COUNTRIES } from '@/constants/countries'
import { motionToken } from '@/lib/motion'
import {
  PERSONAL_EMAIL_RE,
  PERSONAL_PHONE_RE,
  usePersonDetails,
  useSavePersonDetails,
  type PersonDetails,
} from '@/lib/os/peopleAccess'

const EMPTY: PersonDetails = { personal_email: null, personal_phone: null, country_code: null, region: null, city: null }
const NO_COUNTRY = '__none__'
const COUNTRY_OPTIONS = [{ value: NO_COUNTRY, label: 'Not set' }, ...COUNTRIES]

type Draft = Record<keyof PersonDetails, string>
const toDraft = (d: PersonDetails | null): Draft => ({
  personal_email: d?.personal_email ?? '',
  personal_phone: d?.personal_phone ?? '',
  country_code: d?.country_code ?? '',
  region: d?.region ?? '',
  city: d?.city ?? '',
})
const toDetails = (d: Draft): PersonDetails => ({
  personal_email: d.personal_email.trim() || null,
  personal_phone: d.personal_phone.trim() || null,
  country_code: d.country_code || null,
  region: d.region.trim() || null,
  city: d.city.trim() || null,
})
const same = (a: PersonDetails, b: PersonDetails) =>
  (Object.keys(EMPTY) as (keyof PersonDetails)[]).every((k) => (a[k] ?? null) === (b[k] ?? null))

function problems(d: Draft) {
  return {
    personal_email:
      d.personal_email.trim() && !PERSONAL_EMAIL_RE.test(d.personal_email.trim()) ? 'Enter an email like name@example.com.' : undefined,
    personal_phone:
      d.personal_phone.trim() && !PERSONAL_PHONE_RE.test(d.personal_phone.trim())
        ? 'Use digits, spaces, ( ) - and an optional + at the start.'
        : undefined,
  }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'savedAgo' | 'error'

/**
 * A person's personal email, phone and where they live (os_person_details).
 * Used by People & Access admins on the member profile and by each person in
 * Settings > Profile. Saves on its own (§12 autosave): after a pause of
 * --delay-autosave, or when a field loses focus; "Saving…" → "Saved" →
 * "Saved just now". A field that isn't valid yet is never sent.
 */
export function PersonalDetailsForm({
  tenantId,
  userId,
  self,
}: {
  tenantId: string
  userId: string
  /** The person editing their own details (browser autofill is welcome). */
  self?: boolean
}) {
  const details = usePersonDetails(tenantId, userId)
  const save = useSavePersonDetails(tenantId, userId)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [touched, setTouched] = useState<Partial<Record<keyof PersonDetails, boolean>>>({})
  const [state, setState] = useState<SaveState>('idle')
  const timer = useRef<number | null>(null)
  const agoTimer = useRef<number | null>(null)
  const lastSaved = useRef<PersonDetails | null>(null)

  // Fill the form once the saved details arrive (and again for another person).
  useEffect(() => {
    setDraft(null)
    setTouched({})
    setState('idle')
    lastSaved.current = null
  }, [tenantId, userId])
  useEffect(() => {
    if (details.isSuccess && draft === null) {
      setDraft(toDraft(details.data))
      lastSaved.current = details.data ?? EMPTY
    }
  }, [details.isSuccess, details.data, draft])
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
    const p = problems(next)
    if (p.personal_email || p.personal_phone) return
    const value = toDetails(next)
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

  const change = (key: keyof PersonDetails, value: string) => {
    if (!draft) return
    const next = { ...draft, [key]: value }
    setDraft(next)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => flush(next), motionToken('--delay-autosave', 600))
  }
  const blur = (key: keyof PersonDetails) => {
    setTouched((t) => ({ ...t, [key]: true }))
    if (draft) flush(draft)
  }

  if (details.isError) {
    return <LoadError what="their personal details" compact onRetry={() => void details.refetch()} />
  }
  if (!draft) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className={`h-[62px] w-full rounded-[8px] ${i === 0 ? 'md:col-span-2' : ''}`} />
        ))}
      </div>
    )
  }

  const p = problems(draft)
  const id = (k: string) => `pd-${userId}-${k}`
  const status =
    state === 'saving'
      ? 'Saving…'
      : state === 'saved'
        ? 'Saved'
        : state === 'savedAgo'
          ? 'Saved just now'
          : null

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Personal email" htmlFor={id('email')} error={touched.personal_email ? p.personal_email : undefined}>
          <Input
            id={id('email')}
            type="email"
            inputMode="email"
            autoComplete={self ? 'email' : 'off'}
            value={draft.personal_email}
            aria-invalid={touched.personal_email && !!p.personal_email}
            onChange={(e) => change('personal_email', e.target.value)}
            onBlur={() => blur('personal_email')}
            placeholder="name@example.com"
          />
        </FormField>
        <FormField label="Personal phone" htmlFor={id('phone')} error={touched.personal_phone ? p.personal_phone : undefined}>
          <Input
            id={id('phone')}
            type="tel"
            inputMode="tel"
            autoComplete={self ? 'tel' : 'off'}
            value={draft.personal_phone}
            aria-invalid={touched.personal_phone && !!p.personal_phone}
            onChange={(e) => change('personal_phone', e.target.value)}
            onBlur={() => blur('personal_phone')}
            placeholder="+52 55 1234 5678"
          />
        </FormField>
        <FormField label="Country" htmlFor={id('country')}>
          <SearchableSelect
            options={COUNTRY_OPTIONS}
            value={draft.country_code || NO_COUNTRY}
            onValueChange={(v) => {
              const next = { ...draft, country_code: v === NO_COUNTRY ? '' : v }
              setDraft(next)
              flush(next)
            }}
            placeholder="Choose a country"
            searchPlaceholder="Search countries…"
            emptyMessage="No country by that name."
          />
        </FormField>
        <FormField label="State or province" htmlFor={id('region')}>
          <Input
            id={id('region')}
            autoComplete={self ? 'address-level1' : 'off'}
            value={draft.region}
            maxLength={100}
            onChange={(e) => change('region', e.target.value)}
            onBlur={() => blur('region')}
          />
        </FormField>
        <FormField label="City" htmlFor={id('city')}>
          <Input
            id={id('city')}
            autoComplete={self ? 'address-level2' : 'off'}
            value={draft.city}
            maxLength={100}
            onChange={(e) => change('city', e.target.value)}
            onBlur={() => blur('city')}
          />
        </FormField>
      </div>
      {/* Reserved status line: autosave state, or what went wrong with a Retry. */}
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
