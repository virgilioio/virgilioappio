import { Link } from 'react-router-dom'
import { Cake, Camera, Check, ChevronRight, FileSignature, IdCard, Landmark, Link2, ListTodo, MapPin, PartyPopper, Sparkles, type LucideIcon } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { UsefulLinksList } from '@/components/os/UsefulLinks'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBankDetails } from '@/lib/os/bank'
import { usePersonDetails, type Person } from '@/lib/os/peopleAccess'
import { useTaxIds } from '@/lib/os/taxIds'
import { useUsefulLinks } from '@/lib/os/usefulLinks'
import { useTeamCalendar, whenLabel } from '@/lib/os/calendar'
import { countryLabel } from '@/lib/os/countries'
import { SIGN_SENDING_LIVE, useRecordEnvelopes } from '@/lib/sign/send'
import { signersOf } from '@/lib/sign/status'

/**
 * The cards only My profile has (Allan, 2026-10-24: My profile is one view,
 * the details page with its side menu): To do, what's still missing, and the
 * links People & Access pins for everyone. Both sit on the Overview at /me.
 */

interface ToDo {
  key: string
  icon: LucideIcon
  title: string
  body: string
  to: string
}

/** What's still missing from My profile, each a link to the card that fixes it (or a tab). Nothing is counted until it has loaded. */
export function ToDoCard({ tenantId, person }: { tenantId: string; person: Person }) {
  const userId = person.user_id
  const { profile } = useUserProfile()
  const details = usePersonDetails(tenantId, userId)
  const tax = useTaxIds(tenantId, userId)
  const bank = useBankDetails(tenantId, userId)
  const envelopes = useRecordEnvelopes(SIGN_SENDING_LIVE && userId ? { type: 'member', id: person.member_id } : null)

  const queries = [details, tax, bank]
  const loading = !profile || queries.some((q) => q.isLoading) || (SIGN_SENDING_LIVE && envelopes.isLoading)
  const failed = queries.find((q) => q.isError)

  const items: ToDo[] = []
  if (!loading) {
    const d = details.data
    const contact = [!d?.personal_email && 'a personal email', !d?.personal_phone && 'a phone'].filter(Boolean) as string[]
    const contactText = contact.join(' and ')
    if (!profile?.avatar_url || !profile?.title)
      items.push({
        key: 'you',
        icon: Camera,
        title: !profile?.avatar_url && !profile?.title ? 'Add your photo and title' : !profile?.avatar_url ? 'Add your photo' : 'Add your title',
        body: `Candidates see ${!profile?.avatar_url && !profile?.title ? 'them' : 'it'} on every email you send.`,
        to: `/me?focus=card-you`,
      })
    if (!d?.country_code || contact.length)
      items.push({
        key: 'personal',
        icon: MapPin,
        title: !d?.country_code ? 'Add the country you live in' : `Add ${contactText}`,
        body: !d?.country_code
          ? contact.length
            ? `Then ${contactText}, so admins can reach you outside work.`
            : 'It sets which tax IDs and bank details apply to you.'
          : 'So admins can reach you outside work. Only they see it.',
        to: `/me?focus=card-personal`,
      })
    if (!d?.birth_date)
      items.push({
        key: 'birthday',
        icon: Cake,
        title: 'Add your birthday',
        body: 'Teammates see the day and month, never the year.',
        to: `/me?focus=card-personal`,
      })
    if (tax.data && tax.data.ids.length === 0)
      items.push({
        key: 'tax',
        icon: IdCard,
        title: 'Add your tax ID',
        body: 'Virgilio needs it to pay your commissions.',
        to: `/me?focus=card-tax-ids`,
      })
    if (bank.data && !bank.data.has_details)
      items.push({
        key: 'bank',
        icon: Landmark,
        title: 'Add your bank details',
        body: 'Where Virgilio pays your commissions.',
        to: `/me?focus=card-bank`,
      })
    const waiting = (envelopes.data ?? []).filter((e) => e.status === 'sent' && signersOf(e).some((r) => r.status !== 'signed' && !r.removed_at))
    if (waiting.length)
      items.push({
        key: 'sign',
        icon: FileSignature,
        title: waiting.length === 1 ? `Sign ${waiting[0].title}` : `Sign ${waiting.length} agreements`,
        body: 'Gio Sign emailed you the link. Your copy lands here once everyone signs.',
        to: '/me?tab=agreements',
      })
  }

  return (
    <ProfileCard
      id="card-todo"
      title="To do"
      icon={ListTodo}
      tone="yellow"
      aside={
        !loading && items.length > 0 ? (
          <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#FEF3C7] px-2 font-inter text-[12px] font-semibold tabular-nums text-[#B45309]">
            {items.length}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[56px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : failed ? (
        <LoadError what="what's left to do" compact onRetry={() => queries.forEach((q) => void q.refetch())} />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#D1FAE5] text-[#0F9F74]" aria-hidden>
            <Check className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="font-inter text-[12.5px] text-[#1F2230]">
            <span className="block font-medium">You&apos;re all set.</span>
            <span className="text-[#6B7080]">Your profile has everything Virgilio needs.</span>
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((t) => (
            <li key={t.key}>
              <Link
                to={t.to}
                className="group flex min-h-[56px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2.5 transition-colors duration-hover hover:bg-[#F1F0EC]"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#1F2230]" aria-hidden>
                  <t.icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">{t.title}</span>
                  <span className="block font-inter text-[12px] leading-[1.45] text-[#6B7080]">{t.body}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#8B8F9E] transition-colors duration-hover group-hover:text-[#1F2230]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ProfileCard>
  )
}

/** The links People & Access pins for everyone. Hidden when there are none: members can't add any. */
export function UsefulLinksCard({ tenantId }: { tenantId: string }) {
  const links = useUsefulLinks(tenantId)
  const live = (links.data ?? []).filter((l) => !l.archived_at)
  if (links.isSuccess && live.length === 0) return null
  return (
    <ProfileCard id="card-links" title="Useful links" icon={Link2} tone="blue">
      {links.isLoading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[56px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : links.isError ? (
        <LoadError what="the useful links" compact onRetry={() => void links.refetch()} />
      ) : (
        <UsefulLinksList links={live} />
      )}
    </ProfileCard>
  )
}


/**
 * Coming up (2026-10-24): teammates' birthdays in the next 30 days (day and
 * month only) and, in the next 60, the holidays where you live and the
 * workspace's own days off.
 */
export function ComingUpCard({ tenantId }: { tenantId: string }) {
  const cal = useTeamCalendar(tenantId)
  const c = cal.data
  const rows = c
    ? [
        ...c.birthdays.map((b) => ({
          key: `b-${b.user_id}`,
          date: b.date,
          icon: Cake,
          tint: { bg: '#FCE7F3', fg: '#BE185D' },
          title: b.mine ? 'Your birthday' : b.name,
          sub: b.mine ? 'Happy birthday' : 'Birthday',
        })),
        ...c.holidays.map((h) => ({
          key: `h-${h.id}`,
          date: h.date,
          icon: h.own ? Sparkles : PartyPopper,
          tint: h.own ? { bg: '#EDE4FF', fg: '#6F3FF5' } : { bg: '#FEF3C7', fg: '#B45309' },
          title: h.name,
          sub: h.own ? 'Day off at Virgilio' : `Holiday in ${countryLabel(h.country_code)}`,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    : []
  return (
    <ProfileCard id="card-coming-up" title="Coming up" icon={PartyPopper} tone="pink">
      {cal.isLoading ? (
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[52px] w-full rounded-[10px]" />
          ))}
        </div>
      ) : cal.isError ? (
        <LoadError what="what's coming up" compact onRetry={() => void cal.refetch()} />
      ) : rows.length === 0 ? (
        <p className="font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">
          {c?.country_code
            ? 'No birthdays or holidays in the next few weeks.'
            : 'No birthdays in the next few weeks. Add the country you live in to see its holidays here.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.slice(0, 8).map((r) => (
            <li key={r.key} className="flex min-h-[52px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: r.tint.bg, color: r.tint.fg }} aria-hidden>
                <r.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">{r.title}</span>
                <span className="block truncate font-inter text-[12px] text-[#6B7080]">{r.sub}</span>
              </span>
              <span className="shrink-0 font-inter text-[12px] font-medium tabular-nums text-[#5A6072]">{whenLabel(r.date, c!.today)}</span>
            </li>
          ))}
          {rows.length > 8 && (
            <li className="px-1 pt-1 font-inter text-[12px] text-[#6B7080]">And {rows.length - 8} more in the next weeks.</li>
          )}
        </ul>
      )}
    </ProfileCard>
  )
}
