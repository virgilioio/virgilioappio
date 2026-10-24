import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Camera, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Skeleton } from '@/components/ui/skeleton'
import { CopyValue, EditToggle, InfoRow, InfoRows, ProfileCard } from '@/components/os/ProfileParts'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { shakeFirstInvalid } from '@/lib/motion'

interface Draft {
  first_name: string
  last_name: string
  title: string
  phone: string
  linkedin_url: string
  timezone: string
}

const TIMEZONES = [
  'UTC',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Amsterdam',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
].map((v) => ({ value: v, label: v.replace(/_/g, ' ') }))

const PHOTO_MAX = 5 * 1024 * 1024

/**
 * You (Allan, 2026-10-24): the name, photo, title, work phone, time zone and
 * LinkedIn every teammate and candidate sees, on My profile's details. It
 * replaces Settings › Profile. Reads first as rows; the photo changes from the
 * row itself and Edit opens the rest.
 */
export function AccountCard({ note = 'Your teammates see these, and candidates see your name, title and photo on your emails.' }: { note?: string } = {}) {
  const { user } = useAuth()
  const { profile, updateProfile, uploadAvatar } = useUserProfile()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image: PNG, JPG or WebP.')
      return
    }
    if (file.size > PHOTO_MAX) {
      toast.error('That photo is over 5 MB. Choose a smaller one.')
      return
    }
    setUploading(true)
    try {
      await uploadAvatar(file)
      void qc.invalidateQueries({ queryKey: ['os-people'] })
      toast.success('Your photo is updated.')
    } catch {
      toast.error("Couldn't upload the photo. Try again.")
    } finally {
      setUploading(false)
    }
  }

  const initials = ((profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '')).toUpperCase() || (user?.email?.[0]?.toUpperCase() ?? '?')
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')

  return (
    <ProfileCard
      id="card-you"
      title="You"
      icon={UserRound}
      tone="purple"
      aside={profile && !editing ? <EditToggle editing={false} onChange={setEditing} label="your name and details" /> : undefined}
    >
      {!profile ? (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[44px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : editing ? (
        <AccountForm
          initial={{
            first_name: profile.first_name || '',
            last_name: profile.last_name || '',
            title: profile.title || '',
            phone: profile.phone || '',
            linkedin_url: profile.linkedin_url || '',
            timezone: profile.timezone || 'UTC',
          }}
          onSave={async (d) => {
            const hadNoNames = !profile.first_name || !profile.last_name
            await updateProfile(d)
            void qc.invalidateQueries({ queryKey: ['os-people'] })
            if (hadNoNames && d.first_name && d.last_name) void qc.invalidateQueries({ queryKey: ['booking-config'] })
          }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <InfoRows>
            <InfoRow label="Photo" hint="On your emails, booking page and every list">
              <span className="inline-flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
                  <AvatarFallback className="bg-[#EDE4FF] text-[12px] font-medium text-[#6F3FF5]">{initials}</AvatarFallback>
                </Avatar>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void pick(e)} />
                <Button variant="secondary" size="sm" icon={Camera} loading={uploading} onClick={() => fileRef.current?.click()}>
                  {profile.avatar_url ? 'Change' : 'Add photo'}
                </Button>
              </span>
            </InfoRow>
            <InfoRow label="Name">{name}</InfoRow>
            <InfoRow label="Title">{profile.title}</InfoRow>
            <InfoRow label="Work phone">{profile.phone && <CopyValue value={profile.phone} label="work phone" />}</InfoRow>
            <InfoRow label="Time zone">{profile.timezone?.replace(/_/g, ' ')}</InfoRow>
            <InfoRow label="LinkedIn">
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block max-w-[260px] truncate text-[#6F3FF5] underline-offset-2 hover:underline"
                >
                  {profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}
            </InfoRow>
          </InfoRows>
          <p className="pt-3 font-inter text-[11.5px] text-[#6B7080]">
            {note}
          </p>
        </>
      )}
    </ProfileCard>
  )
}

function AccountForm({ initial, onSave, onDone }: { initial: Draft; onSave: (d: Draft) => Promise<void>; onDone: () => void }) {
  const [draft, setDraft] = useState(initial)
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => setDraft(initial), [initial.first_name, initial.last_name]) // eslint-disable-line react-hooks/exhaustive-deps

  const problems: Partial<Record<keyof Draft, string>> = {}
  if (!draft.first_name.trim()) problems.first_name = 'Add your first name.'
  if (!draft.last_name.trim()) problems.last_name = 'Add your last name.'
  if (draft.linkedin_url.trim() && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(draft.linkedin_url.trim()))
    problems.linkedin_url = 'Paste the whole address, starting with https://'
  const show = (k: keyof Draft) => (tried ? problems[k] : undefined)
  const set = (k: keyof Draft, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setServerError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.keys(problems).length) {
      shakeFirstInvalid(formRef.current)
      return
    }
    const clean = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as unknown as Draft
    if ((Object.keys(clean) as (keyof Draft)[]).every((k) => clean[k] === initial[k])) {
      onDone()
      return
    }
    setSaving(true)
    try {
      await onSave(clean)
      toast.success('Your details are saved.')
      onDone()
    } catch {
      setServerError("Couldn't save your details. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={(e) => void submit(e)} noValidate className="space-y-3 py-1">
      <div className="grid gap-x-3 gap-y-1 md:grid-cols-2">
        <FormField label="First name" required htmlFor="you-first" error={show('first_name')}>
          <Input id="you-first" autoComplete="given-name" value={draft.first_name} disabled={saving} onChange={(e) => set('first_name', e.target.value)} />
        </FormField>
        <FormField label="Last name" required htmlFor="you-last" error={show('last_name')}>
          <Input id="you-last" autoComplete="family-name" value={draft.last_name} disabled={saving} onChange={(e) => set('last_name', e.target.value)} />
        </FormField>
        <FormField label="Title" htmlFor="you-title" className="md:col-span-2">
          <Input id="you-title" autoComplete="organization-title" value={draft.title} disabled={saving} onChange={(e) => set('title', e.target.value)} placeholder="Talent Partner" />
        </FormField>
        <FormField label="Work phone" htmlFor="you-phone">
          <Input id="you-phone" type="tel" autoComplete="tel" value={draft.phone} disabled={saving} onChange={(e) => set('phone', e.target.value)} />
        </FormField>
        <FormField label="Time zone" htmlFor="you-tz">
          <SearchableSelect
            options={TIMEZONES.some((t) => t.value === draft.timezone) ? TIMEZONES : [{ value: draft.timezone, label: draft.timezone }, ...TIMEZONES]}
            value={draft.timezone}
            onValueChange={(v) => set('timezone', v || 'UTC')}
            placeholder="Choose a time zone"
            searchPlaceholder="Search time zones…"
            emptyMessage="Not in the list."
            disabled={saving}
          />
        </FormField>
        <FormField
          label="LinkedIn"
          htmlFor="you-linkedin"
          className="md:col-span-2"
          error={show('linkedin_url')}
          helpText={show('linkedin_url') ? undefined : 'Shown on shared candidate cards and your outreach signature.'}
        >
          <Input
            id="you-linkedin"
            type="url"
            inputMode="url"
            value={draft.linkedin_url}
            disabled={saving}
            onChange={(e) => set('linkedin_url', e.target.value)}
            placeholder="https://linkedin.com/in/yourname"
          />
        </FormField>
      </div>
      <p className="min-h-[18px] font-inter text-[12px] text-[#B91C1C]" role={serverError ? 'alert' : undefined}>
        {serverError}
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={saving}>
          Save details
        </Button>
      </div>
    </form>
  )
}
