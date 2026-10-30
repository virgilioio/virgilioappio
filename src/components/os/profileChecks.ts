import * as React from 'react'
import { Cake, Camera, IdCard, Landmark, Mail, MapPin, Package, type LucideIcon } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { usePermissions } from '@/hooks/usePermissions'
import { useTenant } from '@/hooks/useTenant'
import { VIRGILIO_TENANT_ID } from '@/hooks/useChildOrganizationsForJobCreation'

import { useUserProfile } from '@/hooks/useUserProfile'
import { useMailIdentities } from '@/hooks/useMailIdentities'
import { useCalendarIdentities } from '@/hooks/useCalendarIdentities'
import { hasTokenFailure } from '@/lib/googleConnection'
import { useBankDetails } from '@/lib/os/bank'
import { usePersonDetails } from '@/lib/os/peopleAccess'
import { useTaxIds } from '@/lib/os/taxIds'
import { shippingComplete, useShipping } from '@/lib/os/shipping'

/**
 * What a complete profile has (Allan, 2026-10-26): photo and title, Google
 * Workspace (2026-10-28), country and contact, birthday, a tax ID, bank
 * details and a shipping address. My
 * profile's To do card, the welcome dialog and the banner all read this one
 * list, so they always agree. Each check links to the card that fixes it.
 */
export interface ProfileCheck {
  key: 'you' | 'google' | 'personal' | 'birthday' | 'tax' | 'bank' | 'shipping'
  icon: LucideIcon
  /** Short name, for the checklist ("Photo and title"). */
  label: string
  /** The same in a sentence ("photo and title", "tax ID"). */
  inline: string
  /** What to do, when it's missing ("Add your photo"). */
  title: string
  body: string
  to: string
  done: boolean
}

export function useProfileChecks(tenantId: string | undefined, userId: string | null | undefined) {
  const { profile } = useUserProfile()
  const details = usePersonDetails(tenantId, userId)
  const tax = useTaxIds(tenantId, userId)
  const bank = useBankDetails(tenantId, userId)
  const shipping = useShipping(tenantId, userId)
  const mail = useMailIdentities()
  const calendar = useCalendarIdentities()
  const queries = [details, tax, bank, shipping]
  const loading = !profile || queries.some((q) => q.isLoading) || mail.isLoading || calendar.isLoading
  const failed = queries.some((q) => q.isError)

  const checks: ProfileCheck[] = []
  if (!loading && !failed) {
    const d = details.data
    const contact = [!d?.personal_email && 'a personal email', !d?.personal_phone && 'a phone'].filter(Boolean) as string[]
    const contactText = contact.join(' and ')
    const photo = !!profile?.avatar_url
    const title = !!profile?.title
    // The same rule as the card's "Reconnect required" and the database's os_google_broken.
    const google = [...(mail.identities ?? []), ...(calendar.identities ?? [])]
    const googleConnected = google.length > 0
    const googleBroken = google.some(hasTokenFailure)
    checks.push(
      {
        key: 'you',
        icon: Camera,
        label: 'Photo and title',
        inline: 'photo and title',
        title: !photo && !title ? 'Add your photo and title' : !photo ? 'Add your photo' : 'Add your title',
        body: `Candidates see ${!photo && !title ? 'them' : 'it'} on every email you send.`,
        to: '/me?focus=card-you',
        done: photo && title,
      },
      {
        key: 'google',
        icon: Mail,
        label: 'Google Workspace',
        inline: 'Google Workspace',
        title: googleBroken ? 'Reconnect your Google Workspace' : 'Connect your Google Workspace',
        body: googleBroken
          ? 'Google stopped working for you. Candidates’ emails and your calendar wait until you reconnect.'
          : 'Candidates get your emails from your address and interviews land on your calendar.',
        to: '/me?focus=card-google',
        done: googleConnected && !googleBroken,
      },
      {
        key: 'personal',
        icon: MapPin,
        label: 'Country and contact',
        inline: 'country and contact',
        title: !d?.country_code ? 'Add the country you live in' : `Add ${contactText}`,
        body: !d?.country_code
          ? contact.length
            ? `Then ${contactText}, so admins can reach you outside work.`
            : 'It sets which tax IDs and bank details apply to you.'
          : 'So admins can reach you outside work. Only they see it.',
        to: '/me?focus=card-personal',
        done: !!d?.country_code && contact.length === 0,
      },
      {
        key: 'birthday',
        icon: Cake,
        label: 'Birthday',
        inline: 'birthday',
        title: 'Add your birthday',
        body: 'Teammates see the day and month, never the year.',
        to: '/me?focus=card-personal',
        done: !!d?.birth_date,
      },
      {
        key: 'tax',
        icon: IdCard,
        label: 'Tax ID',
        inline: 'tax ID',
        title: 'Add your tax ID',
        body: 'Virgilio needs it to pay your commissions.',
        to: '/me?focus=card-tax-ids',
        done: !tax.data || tax.data.ids.length > 0,
      },
      {
        key: 'bank',
        icon: Landmark,
        label: 'Bank details',
        inline: 'bank details',
        title: 'Add your bank details',
        body: 'Where Virgilio pays your commissions.',
        to: '/me?focus=card-bank',
        done: !bank.data || bank.data.has_details,
      },
      {
        key: 'shipping',
        icon: Package,
        label: 'Shipping address',
        inline: 'shipping address',
        title: 'Add your shipping address',
        body: 'Where Virgilio sends you swag and mail.',
        to: '/me?focus=card-shipping',
        done: shippingComplete(shipping.data),
      },
    )
  }

  const missing = checks.filter((c) => !c.done)
  return {
    loading,
    failed,
    refetch: () => queries.forEach((q) => void q.refetch()),
    checks,
    missing,
    done: checks.length - missing.length,
    total: checks.length,
  }
}

const seenKey = (userId: string) => `gio:profile-invite-seen:${userId}`
const SEEN_EVENT = 'gio:profile-invite-seen'

function readSeen(userId: string | null | undefined) {
  if (!userId) return true
  try {
    return localStorage.getItem(seenKey(userId)) === '1'
  } catch {
    return false
  }
}

/** The dialog has been shown and closed (per browser); the band waits for it. */
export function markInviteSeen(userId: string | null | undefined) {
  if (!userId) return
  try {
    localStorage.setItem(seenKey(userId), '1')
  } catch {
    // Private window: it may show again next time, which is fine.
  }
  window.dispatchEvent(new Event(SEEN_EVENT))
}

function useInviteSeen(userId: string | null | undefined) {
  const [seen, setSeen] = React.useState(() => readSeen(userId))
  React.useEffect(() => {
    setSeen(readSeen(userId))
    const on = () => setSeen(true)
    window.addEventListener(SEEN_EVENT, on)
    return () => window.removeEventListener(SEEN_EVENT, on)
  }, [userId])
  return seen
}

/**
 * Who gets the invitation to fill in My profile (Allan, 2026-10-26): the
 * dialog (`ProfileInviteDialog`) and the band in TopStrip.
 * Virgilio's own people only: never externals, never on /me itself, and gone
 * once nothing is missing.
 */
export function useProfileInvite() {
  const { userId } = useAuth()
  const { tenant } = useTenant()
  const { isExternal } = usePermissions()
  const { pathname } = useLocation()
  const eligible = !!userId && tenant?.id === VIRGILIO_TENANT_ID && !isExternal
  const checks = useProfileChecks(eligible ? tenant?.id : undefined, eligible ? userId : null)
  const onProfile = pathname === '/me' || pathname.startsWith('/me/')
  const show = eligible && !onProfile && !checks.loading && !checks.failed && checks.missing.length > 0
  const seen = useInviteSeen(userId)
  // The dialog first, once; the band only after it.
  return { ...checks, showDialog: show && !seen, showBand: show && seen, userId }
}

/** What's still missing, for a sentence: "Google Workspace, tax ID and 2 more". */
export function missingText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  if (items.length === 3) return `${items[0]}, ${items[1]} and ${items[2]}`
  return `${items[0]}, ${items[1]} and ${items.length - 2} more`
}
