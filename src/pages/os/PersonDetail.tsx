import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Send } from 'lucide-react'
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
  JOB_SEAT_LABEL,
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
  useResendAccess,
  usePersonJobs,
  useSetAppRole,
  type AppKey,
} from '@/lib/os/peopleAccess'
import { GoogleStatus, PersonAvatar, PersonStateBadge } from '@/components/os/PeopleBits'
import { DangerZone } from '@/components/os/DangerZone'
import { PersonJobsTable } from '@/components/os/PersonJobsTable'
import { AgreementsCard } from '@/components/sign/AgreementsCard'

const NO_ACCESS = '__none__'
const TABS = ['overview', 'access', 'jobs', 'agreements'] as const
type Tab = (typeof TABS)[number]

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[#E7E8EE] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#EFEEEA] px-4 py-3">
        <h2 className="font-poppins text-[13.5px] font-semibold tracking-[-0.02em] text-[#1F2230]">{title}</h2>
        {aside}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  )
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** /os/people/:memberId — one person: Overview · Access (with the Danger zone) · Jobs · Agreements. */
export default function PersonDetailPage() {
  const { memberId } = useParams<{ memberId: string }>()
  const { user } = useAuth()
  const { tenant } = useTenant()
  const people = usePeople(tenant?.id)
  const bundles = useBundles(tenant?.id)
  const person = people.data?.find((p) => p.member_id === memberId) ?? null
  const jobs = usePersonJobs(person?.user_id)
  const history = useAudit(tenant?.id, person?.user_id ?? null)
  const setRole = useSetAppRole(tenant?.id)
  const applyBundle = useApplyBundle(tenant?.id)
  const resend = useResendAccess(tenant?.id)
  const [savingApp, setSavingApp] = useState<AppKey | null>(null)
  const [resendingApp, setResendingApp] = useState<AppKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickedBundle, setPickedBundle] = useState<string | null>(null)
  // The tab lives in the URL (?tab=jobs), so a link or Back lands on it.
  const [params, setParams] = useSearchParams()
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'overview'
  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  const nameOf = useMemo(() => {
    const map = new Map((people.data ?? []).filter((p) => p.user_id).map((p) => [p.user_id!, personName(p)]))
    return (id: string | null) => (id ? map.get(id) ?? 'Someone' : 'Gio')
  }, [people.data])

  if (people.isLoading) {
    return (
      <ListPage title={<Skeleton className="inline-block h-9 w-64 align-middle" />} breadcrumb={[{ label: 'People', to: '/os/people' }]}>
        <Skeleton className="h-48 w-full" />
      </ListPage>
    )
  }
  if (!person) {
    return (
      <ListPage title="Not found" breadcrumb={[{ label: 'People', to: '/os/people' }]}>
        <p className="font-inter text-[13px] text-text-secondary">
          This person isn't in your workspace.{' '}
          <Link to="/os/people" className="text-virgilio-purple">
            Back to People
          </Link>
        </p>
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
  const recent = (history.data ?? []).slice(0, 5)

  const historyList = (rows: typeof recent) => (
    <ol className="space-y-2">
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
  const seeAll = (label: string, to: Tab) => (
    <button
      type="button"
      onClick={() => setTab(to)}
      className="font-inter text-[12px] font-medium text-virgilio-purple transition-colors duration-hover hover:text-text-primary"
    >
      {label}
    </button>
  )

  return (
    <ListPage
      breadcrumb={[{ label: 'People', to: '/os/people' }, { label: personName(person) }]}
      title={
        <span className="inline-flex min-w-0 items-center gap-3 align-middle">
          <PersonAvatar person={person} size={36} />
          <span className="truncate">{personName(person)}</span>
        </span>
      }
      meta={
        <>
          {person.email && <span className="truncate">{person.email}</span>}
          <PersonStateBadge person={person} />
          {person.user_type === 'platform_admin' && <Badge tone="ink">Platform admin</Badge>}
          {currentBundle && <span>{currentBundle.name}</span>}
          {joined && !jobs.isLoading && (
            <MetaDot color="#12B886">
              <span className="tabular-nums">
                {jobCounts.open === 0 ? 'No open jobs' : `On ${jobCounts.open} open ${jobCounts.open === 1 ? 'job' : 'jobs'}`}
              </span>
            </MetaDot>
          )}
        </>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Member profile">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="jobs">
            Jobs
            {joined && !jobs.isLoading && <span className="ml-1.5 tabular-nums">{jobList.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <Card title="Contact">
                <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 font-inter text-[12.5px]">
                  <dt className="text-[#6B7080]">Work email</dt>
                  <dd className="truncate text-[#1F2230]">{person.email ?? '—'}</dd>
                  <dt className="text-[#6B7080]">Google account</dt>
                  <dd className="truncate text-[#1F2230]">{person.google_email ?? 'Not connected'}</dd>
                  <dt className="text-[#6B7080]">ATS role</dt>
                  <dd className="text-[#1F2230]">{person.system_role === 'admin' ? 'Admin' : 'Member'}</dd>
                </dl>
              </Card>

              <Card title="Jobs" aside={joined && jobList.length > 0 ? seeAll(`See all ${jobList.length}`, 'jobs') : undefined}>
                {!joined ? (
                  <p className="font-inter text-[12.5px] text-[#6B7080]">No jobs until they accept their invitation.</p>
                ) : jobs.isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : jobList.length === 0 ? (
                  <p className="font-inter text-[12.5px] text-[#6B7080]">
                    Not on any job.{' '}
                    {person.system_role === 'admin' ? 'Admins see every job without a seat.' : "Seat them from a job's Hiring team."}
                  </p>
                ) : (
                  <>
                    <p className="font-inter text-[12.5px] tabular-nums text-[#1F2230]">
                      {jobCounts.open} open · {jobCounts.draft} draft · {jobCounts.closed} closed
                    </p>
                    {openJobs.length > 0 && (
                      <ul className="mt-2 space-y-2">
                        {openJobs.slice(0, 5).map((j) => (
                          <li key={`${j.job_id}-${j.role}`} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/jobs/${j.job_id}`}
                              className="min-w-0 truncate font-inter text-[12.5px] font-medium text-[#1F2230] hover:text-[#6F3FF5]"
                            >
                              {j.title}
                            </Link>
                            <span className="shrink-0 font-inter text-[11.5px] text-[#6B7080]">
                              {JOB_SEAT_LABEL[j.role] ?? j.role}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {openJobs.length > 5 && (
                      <p className="mt-2 font-inter text-[12px] tabular-nums text-[#6B7080]">
                        and {openJobs.length - 5} more open
                      </p>
                    )}
                  </>
                )}
              </Card>

              <Card title="Recent changes" aside={(history.data ?? []).length > 5 ? seeAll('See all', 'access') : undefined}>
                {history.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : recent.length === 0 ? (
                  <p className="font-inter text-[12.5px] text-[#6B7080]">No changes recorded yet.</p>
                ) : (
                  historyList(recent)
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card title="Sign-in">
                <p className="font-inter text-[12.5px] text-[#1F2230]">
                  {person.last_sign_in_at ? `Last signed in ${when(person.last_sign_in_at)}` : 'Has never signed in'}
                </p>
              </Card>

              <Card title="Google Workspace">
                <GoogleStatus person={person} showEmail />
                <p className="mt-2 font-inter text-[11.5px] text-[#6B7080]">
                  {person.google_status === 'connected'
                    ? 'Mail and calendar work in Gio.'
                    : person.google_status === 'reconnect'
                      ? 'Google stopped accepting the connection. They reconnect from Settings › Email & calendar.'
                      : 'They connect from Settings › Email & calendar.'}
                </p>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="access" className="mt-4">
          <div className="max-w-[880px] space-y-4">
            {(notEditableReason || error) && (
              <p
                role={error ? 'alert' : undefined}
                className={`min-h-[18px] rounded-[10px] px-3 py-2 font-inter text-[12.5px] ${error ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F7F6F2] text-[#5A6072]'}`}
              >
                {error ?? notEditableReason}
              </p>
            )}

            <Card title="Job role">
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
            </Card>

            <Card title="Apps and roles">
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
            </Card>

            <Card title="History">
              {history.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (history.data ?? []).length === 0 ? (
                <p className="font-inter text-[12.5px] text-[#6B7080]">No changes recorded yet.</p>
              ) : (
                <div className="max-h-[320px] overflow-y-auto pr-1">{historyList(history.data ?? [])}</div>
              )}
            </Card>

            {tenant?.id && <DangerZone person={person} tenantId={tenant.id} isSelf={isSelf} />}
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {!joined ? (
            <p className="font-inter text-[12.5px] text-[#6B7080]">No jobs until they accept their invitation.</p>
          ) : (
            <PersonJobsTable
              jobs={jobs.data}
              loading={jobs.isLoading}
              error={jobs.isError}
              onRetry={() => void jobs.refetch()}
              firstName={first}
              isAdmin={person.system_role === 'admin'}
            />
          )}
        </TabsContent>

        <TabsContent value="agreements" className="mt-4">
          <div className="max-w-[880px]">
            {joined ? (
              <AgreementsCard
                className="rounded-[12px]"
                source={{ type: 'member', id: person.member_id }}
                recordLabel={personName(person)}
              />
            ) : (
              <p className="font-inter text-[12.5px] text-[#6B7080]">Agreements can be sent once they accept their invitation.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </ListPage>
  )
}
