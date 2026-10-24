import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Briefcase, History, KeyRound, Send, Settings2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { undoToast } from '@/lib/undoToast'

import { ListPage, MetaDot } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import {
  APPS,
  SYNCED_APPS,
  UNDELIVERED_AFTER_MS,
  accessErrorMessage,
  appName,
  describeAudit,
  effectiveGrants,
  jobBucket,
  personName,
  personState,
  resendMessage,
  roleLabel,
  useApplyBundle,
  useAudit,
  useBundles,
  usePeople,
  usePersonDetails,
  useResendAccess,
  usePersonJobs,
  useSetAppRole,
  type AppKey,
} from '@/lib/os/peopleAccess'
import { GoogleStatus, PersonAvatar, PersonStateBadge } from '@/components/os/PeopleBits'
import { LoadError } from '@/components/empty/LoadError'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import { DangerZone } from '@/components/os/DangerZone'
import { PersonJobsTable } from '@/components/os/PersonJobsTable'
import { PersonEarnings } from '@/components/os/PersonEarnings'
import { PersonPerformance } from '@/components/os/PersonPerformance'
import { ProfileCard } from '@/components/os/ProfileParts'
import {
  AccessSummaryCard,
  CurrentWorkCard,
  GeneralCard,
  LatestAgreementsCard,
  PersonalCard,
  RatingCard,
  RoleCard,
} from '@/components/os/ProfileSections'
import { BankDetailsCard } from '@/components/os/BankDetailsCard'
import { ProfileNav, TAB_META, type ProfileTab } from '@/components/os/ProfileNav'
import { COUNTRIES } from '@/constants/countries'
import { loadLevel, segmentLabel, takesSegments, useWorkProfile } from '@/lib/os/workProfile'
import { AgreementsCard } from '@/components/sign/AgreementsCard'

const NO_ACCESS = '__none__'
const TABS: readonly ProfileTab[] = ['overview', 'work', 'earnings', 'agreements', 'access', 'history']
type Tab = ProfileTab
/** My profile (Part B): a member's own page has no Access or History. */
const SELF_TABS: readonly Tab[] = ['overview', 'work', 'earnings', 'agreements']

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/**
 * /os/people/:memberId — one person (Allan, 2026-10-23: Deel's order in our
 * DNA). Tabs: Overview (role, current work, personal, general, rating) · Work
 * · Earnings · Agreements · Access (with the Danger zone) · History. Every
 * card reads first and turns into its form with Edit.
 *
 * With `self` it is /me, My profile (Part B, 2026-10-23): every member's own
 * page. They edit their personal details and see their role, work, earnings
 * and agreements read-only; never the rating, Access or History (os_people
 * returns a member only their own row).
 */
export default function PersonDetailPage({ self = false }: { self?: boolean }) {
  const { memberId } = useParams<{ memberId: string }>()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const people = usePeople(tenant?.id)
  const bundles = useBundles(tenant?.id)
  const person = people.data?.find((p) => (self ? !!user && p.user_id === user.id : p.member_id === memberId)) ?? null
  const jobs = usePersonJobs(person?.user_id)
  const history = useAudit(self ? undefined : tenant?.id, person?.user_id ?? null)
  const work = useWorkProfile(tenant?.id, person?.user_id)
  const details = usePersonDetails(tenant?.id, person?.user_id)
  const setRole = useSetAppRole(tenant?.id)
  const applyBundle = useApplyBundle(tenant?.id)
  const resend = useResendAccess(tenant?.id)
  const [savingApp, setSavingApp] = useState<AppKey | null>(null)
  const [resendingApp, setResendingApp] = useState<AppKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickedBundle, setPickedBundle] = useState<string | null>(null)
  const [peopleRetry, setPeopleRetry] = useState(0)
  const peopleTimedOut = useLoadTimeout(people.isLoading, peopleRetry)
  // The tab lives in the URL (?tab=jobs), so a link or Back lands on it.
  const [params, setParams] = useSearchParams()
  // Older links used ?tab=jobs for what is now Work.
  const rawTab = params.get('tab') === 'jobs' ? 'work' : params.get('tab') ?? ''
  const tabs: readonly Tab[] = self ? SELF_TABS : TABS
  const tab: Tab = (tabs as readonly string[]).includes(rawTab) ? (rawTab as Tab) : 'overview'
  const crumbs = self ? undefined : [{ label: 'People', to: '/os/people' }]
  const setTab = (next: Tab) => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  // §16: a failed or 15s-slow load says so with Retry; it never reads as "Not found".
  const loadFailed = people.isError || peopleTimedOut
  if (people.isLoading && !loadFailed) {
    return (
      <ListPage
        title={<Skeleton className="inline-block h-9 w-64 align-middle" />}
        meta={<Skeleton className="h-4 w-72" />}
        breadcrumb={crumbs}
      >
        <Skeleton className="h-[42px] w-[380px] max-w-full rounded-[9px]" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Skeleton className="h-[150px] w-full rounded-[12px]" />
            <Skeleton className="h-[220px] w-full rounded-[12px]" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-[96px] w-full rounded-[12px]" />
            <Skeleton className="h-[120px] w-full rounded-[12px]" />
          </div>
        </div>
      </ListPage>
    )
  }
  if (loadFailed) {
    return (
      <ListPage title={self ? 'My profile' : 'Member profile'} breadcrumb={crumbs}>
        <div className="rounded-2xl border border-virgilio-border bg-white" style={{ padding: '56px 24px' }}>
          <LoadError
            what="this profile"
            timedOut={peopleTimedOut && !people.isError}
            onRetry={() => {
              setPeopleRetry((n) => n + 1)
              void people.refetch()
            }}
          />
        </div>
      </ListPage>
    )
  }
  if (!person) {
    return (
      <ListPage title={self ? 'My profile' : 'Not found'} breadcrumb={crumbs}>
        {self ? (
          <p className="font-inter text-[13px] text-text-secondary">
            Your profile isn't set up in this workspace yet. An admin adds it from People &amp; Access.
          </p>
        ) : (
          <p className="font-inter text-[13px] text-text-secondary">
            This person isn't in your workspace.{' '}
            <Link to="/os/people" className="text-virgilio-purple">
              Back to People
            </Link>
          </p>
        )}
      </ListPage>
    )
  }

  const isSelf = !!user && person.user_id === user.id
  const joined = !!person.user_id
  const editable = joined && !isSelf && personState(person) !== 'deactivated'
  const grants = effectiveGrants(person)
  const currentBundle = bundles.data?.find((b) => b.id === person.bundle_id) ?? null
  const bundleChoice = pickedBundle ?? person.bundle_id ?? ''
  const chosen = bundles.data?.find((b) => b.id === bundleChoice) ?? null

  const changeRole = async (app: AppKey, role: string | null) => {
    if (!person.user_id) return
    setSavingApp(app)
    setError(null)
    try {
      const previous = grants.find((g) => g.app === app)?.role ?? null
      const userId = person.user_id
      await setRole.mutateAsync({ userId, app, role })
      // §5 Undo over confirm: a role change is reversible.
      undoToast(role ? `${appName(app)}: ${roleLabel(app, role)}` : `${appName(app)} access removed`, async () => {
        try {
          await setRole.mutateAsync({ userId, app, role: previous })
        } catch (err) {
          setError(accessErrorMessage(err))
        }
      })
    } catch (err) {
      setError(accessErrorMessage(err))
    } finally {
      setSavingApp(null)
    }
  }

  // Sends the same role again after the app refused or couldn't be reached.
  const retryApp = async (app: AppKey, role: string) => {
    if (!person.user_id) return
    setSavingApp(app)
    setError(null)
    try {
      await setRole.mutateAsync({ userId: person.user_id, app, role })
    } catch (err) {
      setError(accessErrorMessage(err))
    } finally {
      setSavingApp(null)
    }
  }

  // Sends the app's invitation again (a fresh link), for anyone who hasn't joined it yet.
  const resendApp = async (app: AppKey) => {
    if (!person.user_id) return
    setResendingApp(app)
    setError(null)
    try {
      const result = await resend.mutateAsync({ userId: person.user_id, app })
      toast(resendMessage(app, person.email ?? personName(person), result))
    } catch (err) {
      setError(accessErrorMessage(err, "Couldn't resend the invitation."))
    } finally {
      setResendingApp(null)
    }
  }

  const apply = async () => {
    if (!chosen) return
    setError(null)
    try {
      await applyBundle.mutateAsync({ person, bundle: chosen })
      setPickedBundle(null)
      toast(`${personName(person)} is now ${chosen.name}`)
    } catch (err) {
      setError(accessErrorMessage(err, "Couldn't apply the job role. Some apps may have changed; check the list."))
    }
  }

  const notEditableReason = !joined
    ? "They haven't accepted their invitation yet. Access can be set once they do."
    : isSelf
      ? "This is you. Another admin has to change your access."
      : personState(person) === 'deactivated'
        ? 'Deactivated people keep their history but get no access.'
        : null

  const jobList = jobs.data ?? []
  const openJobs = jobList.filter((j) => jobBucket(j.status) === 'open')
  const jobCounts = {
    open: openJobs.length,
    draft: jobList.filter((j) => jobBucket(j.status) === 'draft').length,
    closed: jobList.filter((j) => jobBucket(j.status) === 'closed').length,
  }
  const first = personName(person).split(' ')[0]
  const historyList = (rows: NonNullable<typeof history.data>) => (
    <ol className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.id} className="flex gap-3 font-inter text-[12.5px]">
          <span className="w-[112px] shrink-0 tabular-nums text-[#6B7080]">{when(row.created_at)}</span>
          <span className="min-w-0 text-[#1F2230]">
            {describeAudit(row, nameOf)}
            <span className="text-[#6B7080]"> · by {nameOf(row.actor_id)}</span>
          </span>
        </li>
      ))}
    </ol>
  )

  // The header's one-line answer to "who is this": job role · segments · status · where · load.
  const segments = work.data && (takesSegments(currentBundle?.name) || work.data.segments.length > 0) ? work.data.segments : []
  const place = details.data
    ? [details.data.city, COUNTRIES.find((c) => c.value === details.data?.country_code)?.label].filter(Boolean).join(', ')
    : ''
  const max = work.data?.max_open_jobs ?? null
  const level = loadLevel(jobCounts.open, max)
  const loadColor = { unset: '#12B886', ok: '#12B886', near: '#F59E0B', over: '#C2372B' }[level]

  return (
    <ListPage
      breadcrumb={self ? undefined : [{ label: 'People', to: '/os/people' }, { label: personName(person) }]}
      actions={
        self ? (
          <Button asChild variant="secondary">
            <Link to="/settings?tab=profile">
              <Settings2 aria-hidden />
              Name, photo and signature
            </Link>
          </Button>
        ) : undefined
      }
      title={
        <span className="inline-flex min-w-0 items-center gap-3 align-middle">
          <PersonAvatar person={person} size={48} />
          <span className="truncate">{personName(person)}</span>
        </span>
      }
      meta={
        <>
          {currentBundle && <span className="font-medium text-[#1F2230]">{currentBundle.name}</span>}
          {segments.length > 0 && <span>{segments.map(segmentLabel).join(' · ')}</span>}
          <PersonStateBadge person={person} />
          {person.user_type === 'platform_admin' && <Badge tone="ink">Platform admin</Badge>}
          {place && <span className="truncate">{place}</span>}
          {joined && jobs.isSuccess && (
            <MetaDot color={loadColor}>
              <span className="tabular-nums">
                {max
                  ? `On ${jobCounts.open} of ${max} open jobs`
                  : jobCounts.open === 0
                    ? 'No open jobs'
                    : `On ${jobCounts.open} open ${jobCounts.open === 1 ? 'job' : 'jobs'}`}
              </span>
            </MetaDot>
          )}
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="lg:grid lg:grid-cols-[224px_minmax(0,1fr)] lg:items-start lg:gap-[26px]">
          <aside className="hidden lg:sticky lg:top-0 lg:block">
            <ProfileNav
              tabs={tabs}
              active={tab}
              onPick={(t) => setTab(t)}
              counts={joined && jobs.isSuccess ? { work: jobList.length } : undefined}
            />
          </aside>
          <div className="min-w-0">
        {/* Below lg the rail folds into the tab bar. */}
        <TabsList aria-label="Member profile" className="lg:hidden">
          {tabs.map((t) => (
            <TabsTrigger key={t} value={t}>
              {TAB_META[t].label}
              {t === 'work' && joined && jobs.isSuccess && <span className="ml-1.5 tabular-nums">{jobList.length}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 lg:mt-0">
          {tenant?.id && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="min-w-0 space-y-4">
                {joined ? (
                  <RoleCard
                    tenantId={tenant.id}
                    person={person}
                    jobRole={currentBundle?.name ?? null}
                    openJobs={jobCounts.open}
                    jobsReady={jobs.isSuccess}
                    editable={!self && personState(person) !== 'deactivated'}
                  />
                ) : (
                  <ProfileCard id="card-role" title="Role" icon={Briefcase} tone="purple">
                    <p className="font-inter text-[12.5px] text-[#6B7080]">Set up once they accept their invitation.</p>
                  </ProfileCard>
                )}
                <CurrentWorkCard
                  person={person}
                  jobs={jobList}
                  loading={jobs.isLoading}
                  error={jobs.isError}
                  onRetry={() => void jobs.refetch()}
                  onSeeAll={() => setTab('work')}
                />
                <LatestAgreementsCard person={person} self={self} onSeeAll={() => setTab('agreements')} />
                {joined && !self && <RatingCard tenantId={tenant.id} person={person} isSelf={isSelf} nameOf={nameOf} />}
              </div>
              <div className="min-w-0 space-y-4">
                <PersonalCard tenantId={tenant.id} person={person} isSelf={isSelf} />
                <GeneralCard person={person} />
                <AccessSummaryCard person={person} onManage={self ? undefined : () => setTab('access')} />
                {joined && <BankDetailsCard tenantId={tenant.id} userId={person.user_id} self={self} name={person.first_name ?? undefined} />}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="work" className="mt-4 lg:mt-0">
          {!joined ? (
            <p className="font-inter text-[12.5px] text-[#6B7080]">No jobs until they accept their invitation.</p>
          ) : (
            <div className="space-y-6">
            <PersonPerformance tenantId={tenant?.id} userId={person.user_id} self={self} />
            <PersonJobsTable
              jobs={jobs.data}
              loading={jobs.isLoading}
              error={jobs.isError}
              onRetry={() => void jobs.refetch()}
              firstName={first}
              isAdmin={person.system_role === 'admin'}
              memoryKey={`os-person:${person.member_id}:jobs`}
            />
            </div>
          )}
        </TabsContent>

        <TabsContent value="earnings" className="mt-4 lg:mt-0">
          <div className="max-w-[960px]">
            {joined ? (
              <PersonEarnings userId={person.user_id} tenantId={tenant?.id} jobs={jobList} jobsLoading={jobs.isLoading} self={self} />
            ) : (
              <p className="font-inter text-[12.5px] text-[#6B7080]">Nothing to show until they accept their invitation.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="agreements" className="mt-4 lg:mt-0">
          <div className="max-w-[960px]">
            {joined ? (
              <AgreementsCard
                className="rounded-[12px]"
                source={{ type: 'member', id: person.member_id }}
                recordLabel={personName(person)}
                readOnly={self}
              />
            ) : (
              <p className="font-inter text-[12.5px] text-[#6B7080]">Agreements can be sent once they accept their invitation.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="access" className="mt-4 lg:mt-0">
          <div className="max-w-[960px] space-y-4">
            {(notEditableReason || error) && (
              <p
                role={error ? 'alert' : undefined}
                className={`min-h-[18px] rounded-[10px] px-3 py-2 font-inter text-[12.5px] ${error ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F7F6F2] text-[#5A6072]'}`}
              >
                {error ?? notEditableReason}
              </p>
            )}

            <ProfileCard title="Job role" icon={KeyRound} tone="purple">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-[220px] flex-1">
                  <Select
                    value={bundleChoice}
                    onValueChange={setPickedBundle}
                    disabled={!editable || applyBundle.isPending}
                  >
                    <SelectTrigger aria-label="Job role">
                      <SelectValue placeholder="No job role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(bundles.data ?? []).map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  disabled={!editable || !chosen}
                  loading={applyBundle.isPending}
                  onClick={apply}
                >
                  {chosen && chosen.id === person.bundle_id ? 'Re-apply job role' : 'Apply job role'}
                </Button>
              </div>
              <p className="mt-2 font-inter text-[11.5px] text-[#6B7080]">
                Applying a job role sets every app below to that role's access, and removes apps it doesn't include.
                {currentBundle && ` Current: ${currentBundle.name}.`}
              </p>
            </ProfileCard>

            <ProfileCard title="Apps and roles" icon={ShieldCheck} tone="purple">
              <ul className="divide-y divide-[#EFEEEA]">
                {APPS.map((app) => {
                  const grant = grants.find((g) => g.app === app.key)
                  const value = grant?.role ?? NO_ACCESS
                  return (
                    <li key={app.key} className="flex flex-wrap items-center gap-3 py-2.5">
                      <div className="min-w-[140px] flex-1">
                        <p className="font-inter text-[13px] font-medium text-[#1F2230]">{app.name}</p>
                        <p className="font-inter text-[11.5px] text-[#6B7080]">
                          {app.key === 'ats'
                            ? person.system_role === 'admin'
                              ? 'Sees everything in the ATS.'
                              : 'Sees the jobs they are on.'
                            : grant?.status === 'pending'
                              ? SYNCED_APPS.has(app.key)
                                ? grant.sync_error ??
                                  (Date.now() - new Date(grant.granted_at).getTime() > UNDELIVERED_AFTER_MS
                                    ? `Not delivered to ${app.name} yet. It keeps trying; you can resend now.`
                                    : `Sending to ${app.name}.`)
                                : `Saved. It reaches ${app.name} once ${app.name} is connected to People & Access.`
                              : grant?.status === 'error'
                                ? `Couldn't apply: ${grant.sync_error ?? `${app.name} refused this change.`}`
                                : grant
                                  ? 'Active.'
                                  : 'No access.'}
                        </p>
                        {grant?.status === 'error' && editable && (
                          <button
                            type="button"
                            disabled={savingApp !== null}
                            onClick={() => void retryApp(app.key, grant.role)}
                            className="mt-1 font-inter text-[12px] font-medium text-virgilio-purple transition-colors duration-hover hover:text-text-primary disabled:opacity-50"
                          >
                            Retry
                          </button>
                        )}
                        {grant && grant.status !== 'error' && SYNCED_APPS.has(app.key) && editable && (
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Send}
                            className="-ml-2 mt-1"
                            loading={resendingApp === app.key}
                            disabled={savingApp !== null || (resendingApp !== null && resendingApp !== app.key)}
                            onClick={() => void resendApp(app.key)}
                          >
                            Resend invitation
                          </Button>
                        )}
                      </div>
                      <div className="w-[190px]">
                        <Select
                          value={value}
                          disabled={!editable || savingApp !== null}
                          onValueChange={(v) => changeRole(app.key, v === NO_ACCESS ? null : v)}
                        >
                          <SelectTrigger aria-label={`${app.name} role`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {app.key !== 'ats' && <SelectItem value={NO_ACCESS}>No access</SelectItem>}
                            {app.roles.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </ProfileCard>

            {tenant?.id && <DangerZone person={person} tenantId={tenant.id} isSelf={isSelf} />}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4 lg:mt-0">
          <div className="max-w-[960px]">
            <ProfileCard title="History" icon={History} tone="neutral">
              {history.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : history.isError ? (
                <LoadError what="their history" compact onRetry={() => void history.refetch()} />
              ) : (history.data ?? []).length === 0 ? (
                <p className="font-inter text-[12.5px] text-[#6B7080]">No changes recorded yet.</p>
              ) : (
                historyList(history.data ?? [])
              )}
            </ProfileCard>
          </div>
        </TabsContent>
          </div>
        </div>
      </Tabs>
    </ListPage>
  )
}
