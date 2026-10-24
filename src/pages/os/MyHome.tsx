import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Camera,
  Check,
  ChevronRight,
  Coins,
  FileSignature,
  IdCard,
  Landmark,
  Link2,
  ListTodo,
  MapPin,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LoadError } from '@/components/empty/LoadError'
import { PersonAvatar } from '@/components/os/PeopleBits'
import { EarningsStrip } from '@/components/os/PersonEarnings'
import { ProfileCard } from '@/components/os/ProfileParts'
import { CurrentWorkCard, LatestAgreementsCard } from '@/components/os/ProfileSections'
import { UsefulLinksList } from '@/components/os/UsefulLinks'
import { useAuth } from '@/contexts/AuthContext'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBankDetails } from '@/lib/os/bank'
import { personName, usePeople, usePersonDetails, usePersonJobs, useBundles, type Person } from '@/lib/os/peopleAccess'
import { useTaxIds } from '@/lib/os/taxIds'
import { useUsefulLinks } from '@/lib/os/usefulLinks'
import { SIGN_SENDING_LIVE, useRecordEnvelopes } from '@/lib/sign/send'
import { signersOf } from '@/lib/sign/status'

const DETAILS = '/me/details'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

/**
 * /me, My profile's home (Allan, 2026-10-24: Deel's home in our DNA). A
 * greeting, the Earned · Pending · Potential strip, what's still missing from
 * the profile (To do), current work, the latest agreements and the links
 * People & Access pins for everyone. The full profile is /me/details; older
 * links to /me?tab=… land there.
 */
export default function MyHomePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const people = usePeople(tenant?.id)
  const bundles = useBundles(tenant?.id)
  const person = people.data?.find((p) => !!user && p.user_id === user.id) ?? null
  const jobs = usePersonJobs(person?.user_id)
  const timedOut = useLoadTimeout(people.isLoading, 0)

  if (new URLSearchParams(location.search).has('tab')) return <Navigate to={`${DETAILS}${location.search}`} replace />

  if (people.isError || timedOut) {
    return (
      <ListPage title="My profile">
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError what="your profile" timedOut={timedOut && !people.isError} onRetry={() => void people.refetch()} />
        </div>
      </ListPage>
    )
  }
  if (people.isLoading) {
    return (
      <ListPage title={<Skeleton className="inline-block h-9 w-72 align-middle" />} meta={<Skeleton className="h-4 w-56" />}>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <Skeleton className="h-[168px] w-full rounded-[16px]" />
            <Skeleton className="h-[260px] w-full rounded-[16px]" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-[240px] w-full rounded-[16px]" />
            <Skeleton className="h-[180px] w-full rounded-[16px]" />
          </div>
        </div>
      </ListPage>
    )
  }
  if (!person) {
    return (
      <ListPage title="My profile">
        <p className="font-inter text-[13px] text-text-secondary">
          Your profile isn&apos;t set up in this workspace yet. An admin adds it from People &amp; Access.
        </p>
      </ListPage>
    )
  }

  const jobRole = bundles.data?.find((b) => b.id === person.bundle_id)?.name ?? null
  const first = personName(person).split(' ')[0]
  const jobList = jobs.data ?? []
  const toDetails = (tab?: string) => navigate(tab ? `${DETAILS}?tab=${tab}` : DETAILS)

  return (
    <ListPage
      title={
        <span className="inline-flex min-w-0 items-center gap-3 align-middle">
          <PersonAvatar person={person} size={48} />
          <span className="truncate">
            {greeting()}, {first}
          </span>
        </span>
      }
      meta={
        <>
          {jobRole && <span className="font-medium text-[#1F2230]">{jobRole}</span>}
          {tenant?.name && <span>{tenant.name}</span>}
        </>
      }
      actions={
        <Button asChild variant="secondary">
          <Link to={DETAILS}>
            <UserRound aria-hidden />
            My details
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <ProfileCard
            id="card-earnings"
            title="Earnings"
            icon={Coins}
            tone="green"
            aside={
              <Button variant="ghost" size="sm" className="bg-[#F1F0EC]" onClick={() => toDetails('earnings')}>
                See all
              </Button>
            }
          >
            <EarningsStrip userId={person.user_id} tenantId={tenant?.id} jobs={jobList} jobsLoading={jobs.isLoading} />
          </ProfileCard>
          <CurrentWorkCard
            person={person}
            jobs={jobList}
            loading={jobs.isLoading}
            error={jobs.isError}
            onRetry={() => void jobs.refetch()}
            onSeeAll={() => toDetails('work')}
          />
          <LatestAgreementsCard person={person} self onSeeAll={() => toDetails('agreements')} />
        </div>
        <div className="min-w-0 space-y-4">
          {tenant?.id && <ToDoCard tenantId={tenant.id} person={person} />}
          {tenant?.id && <LinksCard tenantId={tenant.id} />}
        </div>
      </div>
    </ListPage>
  )
}

interface ToDo {
  key: string
  icon: LucideIcon
  title: string
  body: string
  to: string
}

/** What's still missing from the profile, each a link to where it's fixed. Nothing is counted until it has loaded. */
function ToDoCard({ tenantId, person }: { tenantId: string; person: Person }) {
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
        to: `${DETAILS}?focus=card-you`,
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
        to: `${DETAILS}?focus=card-personal`,
      })
    if (tax.data && tax.data.ids.length === 0)
      items.push({
        key: 'tax',
        icon: IdCard,
        title: 'Add your tax ID',
        body: 'Virgilio needs it to pay your commissions.',
        to: `${DETAILS}?focus=card-tax-ids`,
      })
    if (bank.data && !bank.data.has_details)
      items.push({
        key: 'bank',
        icon: Landmark,
        title: 'Add your bank details',
        body: 'Where Virgilio pays your commissions.',
        to: `${DETAILS}?focus=card-bank`,
      })
    const waiting = (envelopes.data ?? []).filter((e) => e.status === 'sent' && signersOf(e).some((r) => r.status !== 'signed' && !r.removed_at))
    if (waiting.length)
      items.push({
        key: 'sign',
        icon: FileSignature,
        title: waiting.length === 1 ? `Sign ${waiting[0].title}` : `Sign ${waiting.length} agreements`,
        body: 'Gio Sign emailed you the link. Your copy lands here once everyone signs.',
        to: `${DETAILS}?tab=agreements`,
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
function LinksCard({ tenantId }: { tenantId: string }) {
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

