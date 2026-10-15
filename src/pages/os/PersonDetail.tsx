import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { undoToast } from '@/lib/undoToast'

import { ListPage } from '@/components/layout/ListPage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import { JOB_STATUS_TONE } from '@/lib/badge-tones'
import {
  APPS,
  SYNCED_APPS,
  accessErrorMessage,
  appName,
  describeAudit,
  effectiveGrants,
  personName,
  personState,
  roleLabel,
  useApplyBundle,
  useAudit,
  useBundles,
  usePeople,
  usePersonJobs,
  useSetAppRole,
  type AppKey,
} from '@/lib/os/peopleAccess'
import { GoogleStatus, PersonAvatar, PersonStateBadge } from '@/components/os/PeopleBits'
import { OffboardCard } from '@/components/os/OffboardCard'

const NO_ACCESS = '__none__'
const JOB_ROLE_LABEL: Record<string, string> = {
  recruiter: 'TA',
  sourcer: 'Sourcer',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
}

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

/** /os/people/:memberId — one person's access, jobs, Google connection and history. */
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
  const [savingApp, setSavingApp] = useState<AppKey | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pickedBundle, setPickedBundle] = useState<string | null>(null)

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
          </>
        }
      >

      {(notEditableReason || error) && (
        <p
          role={error ? 'alert' : undefined}
          className={`mb-3 min-h-[18px] rounded-[10px] px-3 py-2 font-inter text-[12.5px] ${error ? 'bg-[#FEF2F2] text-[#B91C1C]' : 'bg-[#F7F6F2] text-[#5A6072]'}`}
        >
          {error ?? notEditableReason}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
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
                              ? grant.sync_error ?? `Sending to ${app.name}.`
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
              <ol className="space-y-2">
                {(history.data ?? []).map((row) => (
                  <li key={row.id} className="flex gap-3 font-inter text-[12.5px]">
                    <span className="w-[112px] shrink-0 tabular-nums text-[#6B7080]">{when(row.created_at)}</span>
                    <span className="min-w-0 text-[#1F2230]">
                      {describeAudit(row, nameOf)}
                      <span className="text-[#6B7080]"> · by {nameOf(row.actor_id)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Jobs">
            {!joined ? (
              <p className="font-inter text-[12.5px] text-[#6B7080]">No jobs until they accept their invitation.</p>
            ) : jobs.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (jobs.data ?? []).length === 0 ? (
              <p className="font-inter text-[12.5px] text-[#6B7080]">
                Not on any job. {person.system_role === 'admin' ? '' : 'An admin seats TA and Sourcers on jobs from the job\'s Hiring team.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {(jobs.data ?? []).map((j) => (
                  <li key={`${j.job_id}-${j.role}`} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/jobs/${j.job_id}`}
                      className="min-w-0 truncate font-inter text-[12.5px] font-medium text-[#1F2230] hover:text-[#6F3FF5]"
                    >
                      {j.title}
                    </Link>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="font-inter text-[11.5px] text-[#6B7080]">{JOB_ROLE_LABEL[j.role] ?? j.role}</span>
                      <Badge tone={JOB_STATUS_TONE[j.status] ?? 'neutral'} size="xs">
                        {j.status[0].toUpperCase() + j.status.slice(1)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
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

          <Card title="Sign-in">
            <p className="font-inter text-[12.5px] text-[#1F2230]">
              {person.last_sign_in_at ? `Last signed in ${when(person.last_sign_in_at)}` : 'Has never signed in'}
            </p>
          </Card>

          {tenant?.id && <OffboardCard person={person} tenantId={tenant.id} canOffboard={joined && !isSelf} />}
        </div>
      </div>
    </ListPage>
  )
}

