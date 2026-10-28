import { useState } from 'react'
import { format } from 'date-fns'
import { AlertTriangle, ExternalLink, Plus, RotateCw, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import FormSheet from '@/components/references/FormSheet'
import FormSection from '@/components/references/FormSection'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Loadable } from '@/components/ui/loadable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimatedEmpty } from '@/components/empty/AnimatedEmpty'
import { LoadError } from '@/components/empty/LoadError'
import { confirmDestructive } from '@/components/ui/confirm-dialog'
import { useLoadTimeout } from '@/hooks/useLoadTimeout'
import {
  SLACK_EVENT,
  startSlackConnect,
  useDisconnectSlack,
  useSlackAutomations,
  type SlackAutomation,
  type SlackEvent,
  type SlackStatus,
} from '@/lib/slack'
import { SlackAutomationList } from './SlackAutomationList'
import { SlackAutomationSheet, type AutomationDraftSeed } from './SlackAutomationSheet'

/**
 * Slack's own sheet (Settings › Integrations › Slack › Configure, 2026-10-27).
 * Automations: everything that sends to Slack, the whole workspace's first,
 * then the ones on a job (admins see them all; a Recruiter sees their jobs').
 * Settings: which Slack it is, who connected it, Reconnect and Disconnect.
 */
const STARTERS: Array<{ event: SlackEvent; title: string; body: string }> = [
  { event: 'candidate.hired', title: 'Announce every hire', body: 'Post to a channel with who hired whom, for which client.' },
  { event: 'candidate.applied', title: 'New applicants', body: 'DM the Recruiter when someone applies.' },
  { event: 'scorecard.submitted', title: 'Scorecards in', body: 'Tell the Recruiter when an interviewer submits.' },
]

/** Reminders (2026-10-28): to the one person who has to act, by DM, until it's done. */
const REMINDER_STARTERS: Array<{ event: SlackEvent; title: string; body: string }> = [
  { event: 'offer.approval_waiting', title: 'Approval reminders', body: 'Nudge whoever’s turn it is to approve an offer, every day until they decide.' },
  { event: 'scorecard.due', title: 'Scorecard reminders', body: 'DM interviewers when their scorecard is due, every day until it’s in.' },
]

/** People (2026-10-28): for Virgilio's own team. */
const PEOPLE_STARTERS: Array<{ event: SlackEvent; title: string; body: string }> = [
  { event: 'member.joined', title: 'Welcome new teammates', body: 'DM them a welcome the day they join Gio.' },
  { event: 'member.profile_incomplete', title: 'Profile reminders', body: 'Nudge them every few days until their profile is complete.' },
]

/** Disconnect Slack? (the card's ⋯ and the sheet's Settings ask the same). */
export function askDisconnectSlack(status: SlackStatus | undefined) {
  const n = status?.automations ?? 0
  return confirmDestructive({
    variant: 'remove',
    icon: Unplug,
    title: `Disconnect ${status?.team_name ?? 'Slack'}?`,
    description: `Gio stops sending to Slack and Slack removes Gio\u2019s access. ${n ? `Your ${n} automation${n === 1 ? ' is' : 's are'} kept and paused; ` : ''}reconnect any time to pick up where you left off.`,
    confirmLabel: 'Disconnect Slack',
  })
}

function starterRow(event: SlackEvent): SlackAutomation {
  const def = SLACK_EVENT[event]
  return {
    id: '', job_id: null, job_title: null, name: null, event, filters: def.repeats ? { every_days: def.repeats.initial } : {},
    destinations: def.dmOnly ? [{ type: 'role', role: def.dmOnly }] : event === 'candidate.hired' ? [] : [{ type: 'role', role: 'recruiter' }],
    message: def.message, is_active: true, preset: null, created_by_name: null, updated_at: '',
    last_sent_at: null, last_error: null, last_error_at: null, can_edit: true,
  }
}

export function SlackSheet({
  open,
  onOpenChange,
  tenantId,
  status,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  status: SlackStatus | undefined
}) {
  const [tab, setTab] = useState<'automations' | 'settings'>('automations')
  const [seed, setSeed] = useState<AutomationDraftSeed | null>(null)
  const list = useSlackAutomations(tenantId, null, open)
  const timedOut = useLoadTimeout(list.isLoading, list.dataUpdatedAt)
  const disconnect = useDisconnectSlack(tenantId)
  const [reconnecting, setReconnecting] = useState(false)

  const connected = !!status?.connected
  const working = connected && status?.status !== 'broken'
  const isAdmin = !!status?.is_admin
  const rows = list.data ?? []
  const people = rows.filter((r) => SLACK_EVENT[r.event]?.people)
  const reminders = rows.filter((r) => !r.job_id && SLACK_EVENT[r.event]?.repeats && !SLACK_EVENT[r.event]?.people)
  const workspace = rows.filter((r) => !r.job_id && !SLACK_EVENT[r.event]?.people && !SLACK_EVENT[r.event]?.repeats)
  const onJobs = rows.filter((r) => r.job_id)

  const reconnect = async () => {
    setReconnecting(true)
    try {
      await startSlackConnect(tenantId)
    } catch (e) {
      setReconnecting(false)
      toast.error('Couldn’t reach Slack', { description: e instanceof Error ? e.message : undefined })
    }
  }

  const doDisconnect = async () => {
    const ok = await askDisconnectSlack(status)
    if (!ok) return
    disconnect.mutate(undefined, {
      onSuccess: () => {
        toast.success('Slack disconnected')
        onOpenChange(false)
      },
      onError: (e) => toast.error('Couldn’t disconnect Slack', { description: e.message }),
    })
  }

  const newOne = (row: SlackAutomation | null = null) => setSeed({ id: null, row })

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        width={720}
        eyebrow="Integrations"
        title="Slack"
        subtitle={
          connected
            ? <>Connected to <span className="font-semibold text-text-primary">{status?.team_name}</span>{status?.connected_by ? ` by ${status.connected_by}` : ''}{status?.connected_at ? ` on ${format(new Date(status.connected_at), 'MMM d, yyyy')}` : ''}.</>
            : 'Not connected.'
        }
        headerActions={
          tab === 'automations' && isAdmin ? (
            <Button icon={Plus} size="sm" disabled={!working} onClick={() => newOne()} className="mt-1">
              New automation
            </Button>
          ) : null
        }
      >
        {status?.status === 'broken' && (
          <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl bg-[#FCF1DC] px-3.5 py-3">
            <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-[#9A5B07]" aria-hidden />
            <p className="min-w-0 flex-1 font-inter text-[12.5px] leading-snug text-[#7A4A06]">
              Slack stopped accepting Gio&rsquo;s messages (the app was removed or its access revoked). Nothing is sending until an admin reconnects.
            </p>
            {isAdmin && (
              <Button size="sm" variant="secondary" icon={RotateCw} loading={reconnecting} onClick={() => void reconnect()}>
                Reconnect
              </Button>
            )}
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList indicator="pill" className="mb-4">
            <TabsTrigger value="automations">Automations{rows.length ? ` (${rows.length})` : ''}</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="automations" className="mt-0">
            {list.isError || timedOut ? (
              <LoadError what="automations" timedOut={timedOut && !list.isError} onRetry={() => void list.refetch()} />
            ) : (
              <Loadable
                loading={list.isLoading}
                skeleton={
                  <div className="flex flex-col gap-1.5">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[64px] rounded-[10px]" />)}
                  </div>
                }
              >
                {rows.length === 0 ? (
                  <div className="flex flex-col gap-4">
                    <AnimatedEmpty
                      scene="scheduling"
                      size="compact"
                      onceKey="slack-automations-empty"
                      title="Nothing goes to Slack yet"
                      body={isAdmin ? 'Pick what should reach Slack, where it goes and what it says.' : 'Admins set up the workspace’s automations; your jobs’ own ones live in each job’s Setup.'}
                      primary={isAdmin && working ? { label: 'New automation', icon: <Plus className="h-4 w-4" />, onClick: () => newOne() } : undefined}
                    />
                    {isAdmin && working && (
                      <StarterCards starters={[...STARTERS, ...REMINDER_STARTERS]} columns={3} onPick={(e) => newOne(starterRow(e))} />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {workspace.length > 0 && (
                      <FormSection title="Whole workspace" subtitle="Run for every job, or the jobs their filter names." bare>
                        <SlackAutomationList
                          tenantId={tenantId}
                          rows={workspace}
                          connected={working}
                          onEdit={(row) => setSeed({ id: row.id, row })}
                          onDuplicate={(row) => newOne(row)}
                        />
                      </FormSection>
                    )}
                    {(reminders.length > 0 || (isAdmin && working)) && (
                      <FormSection title="Reminders" subtitle="To the one person who has to act, by DM, until it’s done." bare>
                        {reminders.length > 0 ? (
                          <SlackAutomationList
                            tenantId={tenantId}
                            rows={reminders}
                            connected={working}
                            onEdit={(row) => setSeed({ id: row.id, row })}
                            onDuplicate={(row) => newOne(row)}
                          />
                        ) : (
                          <StarterCards starters={REMINDER_STARTERS} columns={2} onPick={(e) => newOne(starterRow(e))} />
                        )}
                      </FormSection>
                    )}
                    {(people.length > 0 || (isAdmin && working)) && (
                      <FormSection title="People" subtitle="Virgilio’s own team, never external users: welcomes and profile reminders." bare>
                        {people.length > 0 ? (
                          <SlackAutomationList
                            tenantId={tenantId}
                            rows={people}
                            connected={working}
                            onEdit={(row) => setSeed({ id: row.id, row })}
                            onDuplicate={(row) => newOne(row)}
                          />
                        ) : (
                          <StarterCards starters={PEOPLE_STARTERS} columns={2} onPick={(e) => newOne(starterRow(e))} />
                        )}
                      </FormSection>
                    )}
                    {onJobs.length > 0 && (
                      <FormSection title="On a job" subtitle="Set up in each job's Setup › Slack." bare>
                        <SlackAutomationList
                          tenantId={tenantId}
                          rows={onJobs}
                          connected={working}
                          onEdit={(row) => setSeed({ id: row.id, row })}
                          onDuplicate={(row) => setSeed({ id: null, row })}
                        />
                      </FormSection>
                    )}
                  </div>
                )}
              </Loadable>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <FormSection title="Workspace">
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 font-inter text-[13px]">
                <dt className="text-text-tertiary">Slack workspace</dt>
                <dd className="min-w-0 truncate text-text-primary">
                  {status?.team_name ?? '—'}
                  {status?.team_domain && (
                    <a
                      href={`https://${status.team_domain}.slack.com`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-flex items-center gap-1 text-[12px] text-[#6F3FF5] hover:underline"
                    >
                      {status.team_domain}.slack.com <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  )}
                </dd>
                <dt className="text-text-tertiary">Status</dt>
                <dd className="text-text-primary">
                  {status?.status === 'broken' ? 'Needs reconnecting' : connected ? 'Connected' : 'Not connected'}
                </dd>
                <dt className="text-text-tertiary">Connected by</dt>
                <dd className="text-text-primary">
                  {status?.connected_by ?? '—'}
                  {status?.connected_at && <span className="text-text-tertiary"> · {format(new Date(status.connected_at), 'MMM d, yyyy')}</span>}
                </dd>
                <dt className="text-text-tertiary">Bot name</dt>
                <dd className="text-text-primary">@Gio</dd>
              </dl>
            </FormSection>
            {isAdmin ? (
              <FormSection title="Connection" subtitle="Reconnect to switch Slack workspaces or add channels Gio couldn't see.">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" icon={RotateCw} loading={reconnecting} onClick={() => void reconnect()}>
                    Reconnect
                  </Button>
                  <Button variant="danger" icon={Unplug} loading={disconnect.isPending} onClick={() => void doDisconnect()}>
                    Disconnect Slack
                  </Button>
                </div>
                <p className="mt-2 font-inter text-[12px] text-text-tertiary">
                  Disconnecting keeps your automations; they pause until Slack is connected again.
                </p>
              </FormSection>
            ) : (
              <p className="font-inter text-[12.5px] text-text-tertiary">Only admins connect or disconnect Slack.</p>
            )}
          </TabsContent>
        </Tabs>
      </FormSheet>
      <SlackAutomationSheet
        open={!!seed}
        onOpenChange={(o) => !o && setSeed(null)}
        tenantId={tenantId}
        jobId={seed?.row?.job_id ?? null}
        jobTitle={seed?.row?.job_title}
        isAdmin={isAdmin}
        connected={working}
        seed={seed}
      />
    </>
  )
}

/** Ready-made automations to start from: a card each. */
function StarterCards({ starters, columns, onPick }: {
  starters: Array<{ event: SlackEvent; title: string; body: string }>
  columns: 2 | 3
  onPick: (event: SlackEvent) => void
}) {
  return (
    <div className={columns === 3 ? 'grid grid-cols-1 gap-2 sm:grid-cols-3' : 'grid grid-cols-1 gap-2 sm:grid-cols-2'}>
      {starters.map((s) => {
        const Icon = SLACK_EVENT[s.event].icon
        return (
          <button
            key={s.event}
            type="button"
            onClick={() => onPick(s.event)}
            className="gio-pressable flex flex-col items-start gap-1.5 rounded-xl border border-[#E7E8EE] bg-white p-3 text-left transition-colors duration-hover hover:border-[#C9C7BF]"
          >
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-[#EDE4FF] text-[#6F3FF5]">
              <Icon className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="font-inter text-[13px] font-medium text-text-primary">{s.title}</span>
            <span className="font-inter text-[12px] leading-snug text-text-secondary">{s.body}</span>
          </button>
        )
      })}
    </div>
  )
}
