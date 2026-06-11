import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { SettingsCard } from './shared/SettingsCard'
import { StatusChip } from './shared/StatusChip'
import { useIsMobile } from '@/hooks/use-mobile'
import { useRef } from 'react'
import { Mail, ShieldCheck, UserCircle2 } from 'lucide-react'

function formatRoleLabel(value?: string | null) {
  if (!value) return '—'
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface ProfileFormData {
  first_name: string
  last_name: string
  title: string
  phone: string
  linkedin_url: string
  timezone: string
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
].map((v) => ({ value: v, label: v }))

export function ProfileTab() {
  const { user, userType, memberRole } = useAuth()
  const { profile, updateProfile, uploadAvatar, isLoading } = useUserProfile()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [data, setData] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    title: '',
    phone: '',
    linkedin_url: '',
    timezone: 'UTC',
  })

  useEffect(() => {
    if (profile) {
      setData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        title: profile.title || '',
        phone: profile.phone || '',
        linkedin_url: profile.linkedin_url || '',
        timezone: profile.timezone || 'UTC',
      })
    }
  }, [profile])

  const hasChanges = profile && (
    data.first_name !== (profile.first_name || '') ||
    data.last_name !== (profile.last_name || '') ||
    data.title !== (profile.title || '') ||
    data.phone !== (profile.phone || '') ||
    data.linkedin_url !== (profile.linkedin_url || '') ||
    data.timezone !== (profile.timezone || 'UTC')
  )

  const handleSave = async () => {
    const hadNoNames = !profile?.first_name || !profile?.last_name
    const nowHasNames = data.first_name && data.last_name
    await updateProfile(data)
    if (hadNoNames && nowHasNames) {
      queryClient.invalidateQueries({ queryKey: ['booking-config'] })
    }
  }

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadAvatar(file)
    e.target.value = ''
  }

  const initials = ((profile?.first_name?.[0] || '') + (profile?.last_name?.[0] || '')) || (user?.email?.[0]?.toUpperCase() ?? '?')
  const update = (k: keyof ProfileFormData, v: string) => setData((d) => ({ ...d, [k]: v }))

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Profile"
        description="How your name and contact details appear across the workspace."
        footer={
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading || !hasChanges}>
              {isLoading ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Avatar row */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
              <AvatarFallback className="bg-[#EDE4FF] text-[#6F3FF5] text-sm font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!isMobile && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarPick} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change photo
                </Button>
              </>
            )}
          </div>

          {/* Form grid */}
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="First name" required htmlFor="first-name">
              <Input id="first-name" value={data.first_name} onChange={(e) => update('first_name', e.target.value)} />
            </FormField>
            <FormField label="Last name" required htmlFor="last-name">
              <Input id="last-name" value={data.last_name} onChange={(e) => update('last_name', e.target.value)} />
            </FormField>
            <FormField label="Title" htmlFor="title" className="md:col-span-2">
              <Input id="title" value={data.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Talent Partner" />
            </FormField>
            <FormField label="Email" htmlFor="email" helpText="Your sign-in email.">
              <Input id="email" value={user?.email || ''} disabled />
            </FormField>
            <FormField label="Phone" htmlFor="phone">
              <Input id="phone" type="tel" value={data.phone} onChange={(e) => update('phone', e.target.value)} />
            </FormField>
            <FormField label="Timezone" htmlFor="timezone" className="md:col-span-2">
              <SearchableSelect
                options={TIMEZONES}
                value={data.timezone}
                onValueChange={(v) => update('timezone', v)}
                placeholder="Select timezone"
                searchPlaceholder="Search timezones…"
                emptyMessage="No timezones found."
              />
            </FormField>
            <FormField
              label="LinkedIn URL"
              htmlFor="linkedin"
              className="md:col-span-2"
              helpText="Shown on shared candidate cards and outreach signatures."
            >
              <Input
                id="linkedin"
                type="url"
                value={data.linkedin_url}
                onChange={(e) => update('linkedin_url', e.target.value)}
                placeholder="https://linkedin.com/in/yourprofile"
              />
            </FormField>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Account"
        description="Your access level — managed by workspace admins."
      >
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[12.5px] font-inter text-[#0d0d09]">
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-[#8B8F9E]" strokeWidth={2} />
            <dt className="sr-only">Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-[#8B8F9E]" strokeWidth={2} />
            <dt className="text-[#5A6072]">User type</dt>
            <dd>
              <Badge tone="purple" size="xs">{formatRoleLabel(userType)}</Badge>
            </dd>
          </div>
          {memberRole && (
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-3.5 w-3.5 text-[#8B8F9E]" strokeWidth={2} />
              <dt className="text-[#5A6072]">Member role</dt>
              <dd>
                <Badge tone="blue" size="xs">{formatRoleLabel(memberRole)}</Badge>
              </dd>
            </div>
          )}
        </dl>
      </SettingsCard>
    </div>
  )
}
