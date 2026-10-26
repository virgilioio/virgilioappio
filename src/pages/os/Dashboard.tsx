import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  Award,
  Cake,
  CalendarPlus,
  ClipboardList,
  Gauge,
  Globe2,
  History as HistoryIcon,
  MailOpen,
  PartyPopper,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'

import { ListPage } from '@/components/layout/ListPage'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { LoadError } from '@/components/empty/LoadError'
import { PeopleMap } from '@/components/os/PeopleMap'
import { ProfileCard } from '@/components/os/ProfileParts'
import { DayOffDialog } from '@/components/os/DayOffDialog'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { useTenant } from '@/hooks/useTenant'
import { undoToast } from '@/lib/undoToast'
import { describeAudit, personName, useAudit, usePeople } from '@/lib/os/peopleAccess'
import { useArchiveDayOff, usePeopleDashboard, whenLabel, type Holiday } from '@/lib/os/calendar'
import { countryLabel } from '@/lib/os/countries'

const MISSING_LABEL: Record<string, string> = { country: 'Country', tax_id: 'Tax ID', bank: 'Bank details', birthday: 'Birthday' }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** A person on the dashboard: avatar, name, a line, and the right-hand value; the row opens their profile. */
function PersonRow({
  memberId,
  name,
  avatar,
  sub,
  right,
}: {
  memberId: string
  name: string
  avatar: string | null
  sub?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <li>
      <Link
        to={`/os/people/${memberId}`}
        className="flex min-h-[52px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2 transition-colors duration-hover hover:bg-[#F1F0EC]"
      >
        <Avatar className="h-8 w-8 shrink-0">
          {avatar && <AvatarImage src={avatar} alt="" />}
          <AvatarFallback className="bg-[#EDE4FF] text-[11px] font-medium text-[#6F3FF5]">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">{name}</span>
          {sub && <span className="block truncate font-inter text-[12px] text-[#6B7080]">{sub}</span>}
        </span>
        {right && <span className="shrink-0 font-inter text-[12px] font-medium tabular-nums text-[#5A6072]">{right}</span>}
      </Link>
    </li>
  )
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-[52px] w-full rounded-[10px]" />
      ))}
    </div>
  )
}

const Quiet = ({ children }: { children: React.ReactNode }) => (
  <p className="font-inter text-[12.5px] leading-[1.5] text-[#6B7080]">{children}</p>
)

/**
 * /os (People & Access › Dashboard, Allan 2026-10-24): the team at a glance,
 * in the analytics look: a KPI strip, then cards for upcoming birthdays,
 * holidays where people live (with the workspace's own days off, added here),
 * work anniversaries, where people live, missing details, load and the latest
 * changes. Counted on the server (os_people_dashboard); admins only.
 */
export default function PeopleDashboardPage() {
  const { tenant } = useTenant()
  const dash = usePeopleDashboard(tenant?.id)
  const people = usePeople(tenant?.id)
  const audit = useAudit(tenant?.id)
  const archive = useArchiveDayOff(tenant?.id)
  const [adding, setAdding] = useState(false)
  const [retry, setRetry] = useState(0)
  const timedOut = useLoadTimeout(dash.isLoading, retry)
  const d = dash.data
  const first = dash.isLoading

  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  const archiveDay = (h: Holiday) =>
    archive.mutate(
      { id: h.id, archived: true },
      {
        onSuccess: () =>
          undoToast(`${h.name} removed`, () =>
            archive.mutate({ id: h.id, archived: false }, { onError: () => toast.error(`Couldn't bring back ${h.name}. Try again.`) }),
          ),
        onError: () => toast.error(`Couldn't remove ${h.name}. Try again.`),
      },
    )

  if (dash.isError || timedOut) {
    return (
      <ListPage title="Dashboard">
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError
            what="the dashboard"
            timedOut={timedOut && !dash.isError}
            onRetry={() => {
              setRetry((n) => n + 1)
              void dash.refetch()
            }}
          />
        </div>
      </ListPage>
    )
  }

  const recent = (audit.data ?? []).slice(0, 10)
  const mapData = (d?.by_country ?? [])
    .filter((c) => c.country_code)
    .map((c) => ({ country_code: c.country_code as string, people: c.people }))
  const unknown = d?.by_country.find((c) => !c.country_code)?.people ?? 0

  return (
    <ListPage
      title="Dashboard"
      meta={<span>Your team at a glance: who&apos;s celebrating, who&apos;s off, and what&apos;s missing.</span>}
      actions={
        <Button variant="secondary" icon={CalendarPlus} onClick={() => setAdding(true)} disabled={!tenant?.id}>
          Add a day off
        </Button>
      }
    >
      <div className="space-y-4">
        <MetricStrip
          id="os-dashboard"
          loading={first}
          items={[
            { label: 'Active people', icon: Users, tone: 'purple', value: d?.active ?? 0 },
            { label: 'Open invitations', icon: MailOpen, tone: 'blue', value: d?.invited ?? 0 },
            {
              label: 'Profiles complete',
              icon: UserCheck,
              tone: 'green',
              value: d?.complete ?? 0,
              format: (v) => `${Math.round(v)} of ${d?.active ?? 0}`,
              detail: 'Country, tax ID and bank details',
            },
            {
              label: 'Near or over their limit',
              icon: Gauge,
              tone: (d?.over_capacity ?? 0) > 0 ? 'pink' : 'yellow',
              value: (d?.near_capacity ?? 0) + (d?.over_capacity ?? 0),
              detail: d && d.over_capacity > 0 ? `${d.over_capacity} over` : undefined,
            },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ProfileCard title="Birthdays" icon={Cake} tone="pink">
            {first ? (
              <ListSkeleton />
            ) : !d || d.birthdays.length === 0 ? (
              <Quiet>No birthdays in the next 30 days. People add theirs in My profile.</Quiet>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.birthdays.map((b) => (
                  <PersonRow key={b.user_id} memberId={b.member_id} name={b.name} avatar={b.avatar_url} right={whenLabel(b.date, d.today)} />
                ))}
              </ul>
            )}
          </ProfileCard>

          <ProfileCard title="Holidays" icon={PartyPopper} tone="yellow">
            {first ? (
              <ListSkeleton />
            ) : !d || d.holidays.length === 0 ? (
              <Quiet>No holidays in the next 60 days where your people live.</Quiet>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.holidays.map((h) => (
                  <li key={h.id} className="group flex min-h-[52px] items-center gap-3 rounded-[10px] bg-[#F7F6F2] px-3.5 py-2">
                    <span
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={h.own ? { background: '#EDE4FF', color: '#6F3FF5' } : { background: '#FEF3C7', color: '#B45309' }}
                      aria-hidden
                    >
                      {h.own ? <Sparkles className="h-4 w-4" /> : <PartyPopper className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-inter text-[13px] font-medium text-[#1F2230]">
                        {h.local_name && h.local_name !== h.name ? h.local_name : h.name}
                      </span>
                      <span className="block truncate font-inter text-[12px] text-[#6B7080]">
                        {h.own ? 'Day off at Virgilio' : countryLabel(h.country_code)}
                        {h.people > 0 && ` · ${h.people} ${h.people === 1 ? 'person' : 'people'}: ${h.names.slice(0, 2).join(', ')}${h.people > 2 ? ` and ${h.people - 2} more` : ''}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-inter text-[12px] font-medium tabular-nums text-[#5A6072]">{whenLabel(h.date, d.today)}</span>
                    {h.own && (
                      <IconTip label={`Remove ${h.name}`}>
                        <button
                          type="button"
                          aria-label={`Remove ${h.name}`}
                          onClick={() => archiveDay(h)}
                          className="gio-pressable inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#6B7080] transition-colors duration-hover hover:bg-[#ECEAE2] hover:text-[#1F2230]"
                        >
                          <Archive size={14} />
                        </button>
                      </IconTip>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ProfileCard>

          <ProfileCard title="Work anniversaries" icon={Award} tone="purple">
            {first ? (
              <ListSkeleton rows={2} />
            ) : !d || d.anniversaries.length === 0 ? (
              <Quiet>No work anniversaries in the next 30 days. Start dates are set on each person&apos;s Role card.</Quiet>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.anniversaries.map((a) => (
                  <PersonRow
                    key={a.user_id}
                    memberId={a.member_id}
                    name={a.name}
                    avatar={a.avatar_url}
                    sub={`${a.years} ${a.years === 1 ? 'year' : 'years'} at Virgilio`}
                    right={whenLabel(a.date, d.today)}
                  />
                ))}
              </ul>
            )}
          </ProfileCard>

          <div className="lg:col-span-2">
            <ProfileCard title="Where people live" icon={Globe2} tone="blue">
              {first ? (
                <Skeleton className="h-[220px] w-full rounded-[10px]" />
              ) : mapData.length === 0 ? (
                <Quiet>Nobody has added the country they live in yet.</Quiet>
              ) : (
                <>
                  <PeopleMap byCountry={mapData} places={d?.places ?? []} />
                  {unknown > 0 && (
                    <p className="pt-2 font-inter text-[12px] text-[#6B7080]">
                      {unknown} {unknown === 1 ? 'person hasn’t' : 'people haven’t'} added their country yet.
                    </p>
                  )}
                </>
              )}
            </ProfileCard>
          </div>

          <ProfileCard title="Near or over their limit" icon={Gauge} tone="yellow">
            {first ? (
              <ListSkeleton rows={2} />
            ) : !d || d.load.length === 0 ? (
              <Quiet>Everyone with a limit has room. Limits are set on each person&apos;s Role card.</Quiet>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {d.load.map((l) => (
                  <PersonRow
                    key={l.user_id}
                    memberId={l.member_id}
                    name={l.name}
                    avatar={l.avatar_url}
                    sub={l.load === 'over' ? 'Over their limit' : 'Near their limit'}
                    right={
                      <span className={l.load === 'over' ? 'text-[#C2372B]' : 'text-[#B45309]'}>
                        {l.open_jobs} of {l.max_open_jobs}
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </ProfileCard>

          <div className="lg:col-span-2">
            <ProfileCard
              title="Missing information"
              icon={ClipboardList}
              tone="neutral"
              aside={
                d && d.missing.length > 0 ? (
                  <span className="font-inter text-[12px] tabular-nums text-[#6B7080]">
                    {d.missing.length} {d.missing.length === 1 ? 'person' : 'people'}
                  </span>
                ) : undefined
              }
            >
              {first ? (
                <ListSkeleton />
              ) : !d || d.missing.length === 0 ? (
                <Quiet>Everyone&apos;s profile is complete.</Quiet>
              ) : (
                <ul className="grid max-h-[420px] gap-1.5 overflow-y-auto md:grid-cols-2">
                  {d.missing.map((m) => (
                    <PersonRow
                      key={m.user_id}
                      memberId={m.member_id}
                      name={m.name}
                      avatar={m.avatar_url}
                      sub={m.missing.map((k) => MISSING_LABEL[k] ?? k).join(' · ')}
                    />
                  ))}
                </ul>
              )}
            </ProfileCard>
          </div>

          <ProfileCard
            title="Recent changes"
            icon={HistoryIcon}
            tone="neutral"
            aside={
              <Button asChild variant="ghost" size="sm" className="bg-[#F1F0EC]">
                <Link to="/os/history">See all</Link>
              </Button>
            }
          >
            {audit.isLoading ? (
              <ListSkeleton />
            ) : audit.isError ? (
              <LoadError what="the history" compact onRetry={() => void audit.refetch()} />
            ) : recent.length === 0 ? (
              <Quiet>No changes yet.</Quiet>
            ) : (
              <ol className="space-y-2.5">
                {recent.map((r) => (
                  <li key={r.id} className="font-inter text-[12.5px] leading-[1.45]">
                    <span className="text-[#1F2230]">{describeAudit(r, nameOf)}</span>
                    <span className="block text-[11.5px] text-[#6B7080]">
                      {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · by{' '}
                      {nameOf(r.actor_id)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </ProfileCard>
        </div>
      </div>
      {tenant?.id && (
        <DayOffDialog
          open={adding}
          onOpenChange={setAdding}
          tenantId={tenant.id}
          countries={(d?.by_country ?? []).map((c) => c.country_code).filter((c): c is string => !!c)}
        />
      )}
    </ListPage>
  )
}
