import { useEffect, useRef, useState } from 'react'

import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { CityPicker, CountryPicker, RegionPicker } from '@/components/ui/place-picker'
import { placeChange } from '@/lib/places'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/empty/LoadError'
import { motionToken } from '@/lib/motion'
import {
  PERSONAL_EMAIL_RE,
  PERSONAL_PHONE_RE,
  usePersonDetails,
  useSavePersonDetails,
  type PersonDetails,
} from '@/lib/os/peopleAccess'
import { fromIsoDay, toIsoDay } from '@/lib/isoDay'

const EMPTY: PersonDetails = { personal_email: null, personal_phone: null, country_code: null, region: null, city: null, birth_date: null }

type Draft = Record<keyof PersonDetails, string>
const toDraft = (d: PersonDetails | null): Draft => ({
  personal_email: d?.personal_email ?? '',
  personal_phone: d?.personal_phone ?? '',
  country_code: d?.country_code ?? '',
  region: d?.region ?? '',
  city: d?.city ?? '',
  birth_date: d?.birth_date ?? '',
})
const toDetails = (d: Draft): PersonDetails => ({
  personal_email: d.personal_email.trim() || null,
  personal_phone: d.personal_phone.trim() || null,
  country_code: d.country_code || null,
  region: d.region.trim() || null,
  city: d.city.trim() || null,
  birth_date: d.birth_date || null,
})
const same = (a: PersonDetails, b: PersonDetails) =>
  (Object.keys(EMPTY) as (keyof PersonDetails)[]).every((k) => (a[k] ?? null) === (b[k] ?? null))

/** The latest birth date the database takes: 14 years ago today. */
const latestBirth = () => {
  const t = new Date()
  return `${t.getFullYear() - 14}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function problems(d: Draft) {
  return {
    birth_date:
      d.birth_date && (d.birth_date < '1900-01-01' || d.birth_date > latestBirth()) ? 'Check the date: it can\'t be in the future or less than 14 years ago.' : undefined,
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
 * A person's personal email, phone, date of birth and where they live
 * (os_person_details). Used by People & Access admins on the member profile
 * and by each person on My profile. Saves on its own (§12 autosave): after a pause of
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
    if (p.personal_email || p.personal_phone || p.birth_date) return
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
  // A place is picked in one go too: the country clears its state and city.
  const place = (key: 'country' | 'region' | 'city', value: string, regionOfCity?: string) => {
    if (!draft) return
    const p = placeChange({ country: draft.country_code, region: draft.region, city: draft.city }, key, value, regionOfCity)
    const next = { ...draft, country_code: p.country, region: p.region, city: p.city }
    setDraft(next)
    flush(next)
  }
  // A date is picked in one go, so it saves at once.
  const pick = (birth: string) => {
    if (!draft) return
    const next = { ...draft, birth_date: birth }
    setDraft(next)
    setTouched((t) => ({ ...t, birth_date: true }))
    flush(next)
  }

  if (details.isError) {
    return <LoadError what="their personal details" compact onRetry={() => void details.refetch()} />
  }
  if (!draft) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
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
        <FormField
          label="Date of birth"
          htmlFor={id('birth')}
          error={touched.birth_date ? p.birth_date : undefined}
          helpText={touched.birth_date && p.birth_date ? undefined : 'Teammates see the day and month, never the year.'}
        >
          <DatePickerVirgilio
            id={id('birth')}
            className="h-11 w-full"
            placeholder="Not set"
            presets={false}
            minDate={fromIsoDay('1900-01-01')}
            maxDate={fromIsoDay(latestBirth())}
            defaultMonth={fromIsoDay(`${new Date().getFullYear() - 30}-01-01`)}
            value={fromIsoDay(draft.birth_date)}
            aria-invalid={touched.birth_date && !!p.birth_date}
            onChange={(d) => pick(toIsoDay(d))}
            onClear={() => pick('')}
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
            onChange={(v, region) => place('city', v, region)}
            placeholder="Not set"
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
