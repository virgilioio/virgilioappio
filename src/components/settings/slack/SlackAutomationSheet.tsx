import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Link2, Lock, Send, SendHorizontal, Users } from 'lucide-react'
import { toast } from 'sonner'
import FormSheet from '@/components/references/FormSheet'
import FormSection from '@/components/references/FormSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CharCounterLine } from '@/components/ui/char-counter'
import { FilterChipPopover } from '@/components/ui/filter-chip-popover'
import { UnsavedGuard } from '@/components/ui/unsaved-guard'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { shakeFirstInvalid } from '@/lib/motion'
import {
  LINK_DETAILS,
  SLACK_DETAILS,
  SLACK_EVENT,
  SLACK_EVENTS,
  asksForPay,
  canSendNow,
  decodeSlackMessage,
  destinationsSentence,
  encodeSlackMessage,
  unknownDetails,
  useJobStageOptions,
  useSaveSlackAutomation,
  useSlackDirectory,
  useSlackFilterOptions,
  useSlackTest,
  type SlackAutomation,
  type SlackDestination,
  type SlackRole,
  type SlackEvent,
  type SlackFilters,
  type SlackTag,
} from '@/lib/slack'
import { cn } from '@/lib/utils'
import { title as automationTitle } from './SlackAutomationList'
import { SlackDestinationsField } from './SlackDestinationsField'
import { SendNowDialog, SlackHistoryPanel } from './SlackHistory'
import { SlackMessageBox } from './SlackMessageBox'
import { SlackPreview } from './SlackPreview'

/**
 * Add or edit a Slack automation (2026-10-27): When (the event), Only when
 * (optional filters), Send to (channels, Slack people, the job's people),
 * the Message with {details} and @tags, a live Slack preview and an optional
 * name. Send test posts it once with example details; Save keeps it. A dirty
 * sheet asks before it closes (§13). Workspace-wide when `jobId` is null.
 * People events (2026-10-28) are workspace-wide and admins' only: no job
 * filters, the team member in Send to, and a profile reminder goes only to
 * them, every 3, 5, 7 or 14 days. An existing one has a History tab
 * (2026-10-28): what it sent, Send again, and Send now for reminders; someone
 * who can't change it (a job's Recruiter on a workspace one) sees History only.
 */

export interface AutomationDraftSeed {
  /** Editing this one (null: a new one, maybe a copy). */
  id: string | null
  row?: SlackAutomation | null
  /** Open on its History. */
  tab?: 'automation' | 'history'
}

const MAX = 3000
const GROUPS = ['Candidates', 'Interviews', 'Offers', 'Jobs', 'People'] as const
/** Who a DM-only event goes to, as the Send to row and its note say it. */
const DM_ONLY: Partial<Record<SlackRole, { who: string; note: string }>> = {
  member: { who: 'The team member', note: 'Profile reminders and Google alerts only go to the person, by DM.' },
  approver: { who: 'The offer approver, on their turn', note: 'Approval reminders only go to the approver whose turn it is, by DM.' },
  interviewer: { who: 'The interviewer who owes it', note: 'Scorecard reminders only go to the interviewer, by DM.' },
}

export function SlackAutomationSheet({
  open,
  onOpenChange,
  tenantId,
  jobId,
  jobTitle,
  isAdmin,
  connected,
  seed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  jobId: string | null
  jobTitle?: string | null
  isAdmin: boolean
  connected: boolean
  seed: AutomationDraftSeed | null
}) {
  const directory = useSlackDirectory(tenantId, open && connected)
  const options = useSlackFilterOptions(tenantId, open && !jobId)
  const jobStages = useJobStageOptions(open ? jobId : null)
  const save = useSaveSlackAutomation(tenantId)
  const test = useSlackTest(tenantId)

  const [event, setEvent] = useState<SlackEvent>('candidate.hired')
  const [filters, setFilters] = useState<SlackFilters>({})
  const [destinations, setDestinations] = useState<SlackDestination[]>([])
  const [draft, setDraft] = useState('')
  const [picked, setPicked] = useState<SlackTag[]>([])
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [baseline, setBaseline] = useState('')
  const [settled, setSettled] = useState(false)
  const [tab, setTab] = useState<'automation' | 'history'>('automation')
  const [sendingNow, setSendingNow] = useState(false)
  const insertRef = useRef<((text: string) => void) | null>(null)

  // A fresh draft each time the sheet opens.
  useEffect(() => {
    if (!open) return
    const row = seed?.row ?? null
    const ev = row?.event ?? 'candidate.hired'
    setEvent(ev)
    setFilters(row?.filters ?? {})
    setDestinations(row?.destinations ?? [])
    setDraft(row?.message ?? SLACK_EVENT[ev].message)
    setPicked([])
    setName(seed?.id ? row?.name ?? '' : row?.name ? `${row.name} (copy)` : '')
    setTried(false)
    setError(null)
    setAsking(false)
    setSettled(false)
    setBaseline('')
    setTab(seed?.tab ?? 'automation')
    setSendingNow(false)
  }, [open, seed])

  // Saved tags (<@U…>) read as "@Name" once your Slack's people are here.
  useEffect(() => {
    if (!open || settled) return
    if (directory.data) {
      const { draft: d, picked: p } = decodeSlackMessage(seed?.row?.message ?? draft, directory.data.users)
      if (seed?.row) setDraft(d)
      setPicked(p)
      setSettled(true)
    } else if (!connected || directory.isError) setSettled(true)
  }, [open, settled, directory.data, directory.isError, connected, seed, draft])

  const snapshot = JSON.stringify({ event, filters, destinations, draft, name })
  // The settled draft is what "unchanged" means.
  useEffect(() => {
    if (open && settled && !baseline) setBaseline(snapshot)
  }, [open, settled, baseline, snapshot])
  const dirty = open && !!baseline && baseline !== snapshot

  const def = SLACK_EVENT[event]
  // People events are the workspace's, set up by admins.
  const events = SLACK_EVENTS.filter(
    (e) => e.key === event || (!(e.people && jobId) && (isAdmin || (!e.offer && !e.people))),
  )
  const unknown = unknownDetails(draft, event)
  const pay = asksForPay(draft)

  const problem = useMemo(() => {
    if (!connected) return 'Connect Slack first'
    if (destinations.length === 0) return 'Pick where it goes'
    if (!draft.trim()) return 'Write the message'
    if (draft.length > MAX) return 'The message is too long'
    if (pay) return 'Slack messages can’t include pay'
    return null
  }, [connected, destinations.length, draft, pay])

  const saved = seed?.id && seed.row ? seed.row : null
  // Someone who can't change it reads its History only.
  const readOnly = !!saved && !saved.can_edit
  const onHistory = readOnly || tab === 'history'

  const close = () => {
    if (save.isPending) return
    if (dirty) setAsking(true)
    else onOpenChange(false)
  }

  const changeEvent = (next: SlackEvent) => {
    // A message still at the old default follows the new event.
    if (draft.trim() === SLACK_EVENT[event].message || !draft.trim()) setDraft(SLACK_EVENT[next].message)
    const to = SLACK_EVENT[next]
    // Roles the new event can't DM go; a DM-only event goes to its one person.
    setDestinations((ds) =>
      to.dmOnly ? [{ type: 'role', role: to.dmOnly }] : ds.filter((d) => d.type !== 'role' || to.roles.includes(d.role)))
    // People events have no job filters; only reminders repeat, each with its
    // own choices; stage filters only where stages apply.
    setFilters((f) => {
      const every = to.repeats ? (to.repeats.options.includes(f.every_days ?? -1) ? f.every_days : to.repeats.initial) : undefined
      if (to.people) return every ? { every_days: every } : {}
      const { every_days: _every, ...rest } = f
      if (!to.stages) delete rest.stage_ids
      return every ? { ...rest, every_days: every } : rest
    })
    setEvent(next)
  }

  const payload = () => ({
    job_id: jobId,
    event,
    message: encodeSlackMessage(draft, picked).trim(),
    destinations,
  })

  const submit = async () => {
    setTried(true)
    setError(null)
    if (problem) {
      shakeFirstInvalid()
      return
    }
    try {
      await save.mutateAsync({
        id: seed?.id ?? null,
        name: name.trim() || null,
        filters: cleanFilters(filters),
        is_active: seed?.row?.is_active ?? true,
        ...payload(),
      })
      onOpenChange(false)
      toast.success(seed?.id ? 'Automation saved' : 'Automation on', {
        description: `${def.when}, Gio sends to ${destinationsSentence(destinations)}.`,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t save it. Try again.')
    }
  }

  const sendTest = () => {
    setTried(true)
    if (problem) {
      shakeFirstInvalid()
      return
    }
    const id = toast.loading('Sending a test to Slack…')
    test.mutate(payload(), {
      onSuccess: ({ results }) => {
        const bad = results.filter((r) => !r.ok || r.problem)
        if (bad.length === 0) toast.success('Test sent', { id, description: `Check ${destinationsSentence(destinations)} in Slack.` })
        else toast.error(bad.length === results.length ? 'The test didn’t go out' : 'The test partly went out', { id, description: bad.map((b) => b.problem).filter(Boolean).join(' ') })
      },
      onError: (e) => toast.error('The test didn’t go out', { id, description: e.message }),
    })
  }

  const stageOptions = jobId ? jobStages.data ?? [] : options.data?.stages ?? []
  const hasFilters = !def.people && (!jobId || def.stages)
  const every = filters.every_days ?? 0
  const dmOnly = def.dmOnly ? DM_ONLY[def.dmOnly] : undefined
  const showError = tried ? problem : null

  return (
    <FormSheet
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      width={680}
      eyebrow={jobId ? `Slack · ${jobTitle ?? 'this job'}` : def.people ? 'Slack · People' : 'Slack · whole workspace'}
      title={readOnly && saved ? automationTitle(saved) : seed?.id ? 'Edit automation' : 'New automation'}
      subtitle={
        def.people
          ? 'For Virgilio’s own team, never external users.'
          : jobId
            ? 'Runs for this job only.'
            : 'Runs for every job, unless you narrow it below.'
      }
      footer={onHistory && saved ? (
        <div className="relative flex w-full items-center gap-2.5">
          <Button variant="ghost" onClick={close}>
            Close
          </Button>
          <p className="min-w-0 flex-1 truncate font-inter text-[11.5px] text-text-tertiary">
            {canSendNow(saved) ? 'Reminders go out on their schedule; Send now reaches everyone waiting.' : 'Messages show here as they go out.'}
          </p>
          {canSendNow(saved) && (
            <Button icon={SendHorizontal} onClick={() => setSendingNow(true)} disabled={!connected || !saved.is_active}>
              Send now
            </Button>
          )}
          <UnsavedGuard
            open={asking}
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false)
              onOpenChange(false)
            }}
          />
        </div>
      ) : (
        <div className="relative flex w-full items-center gap-2.5">
          <Button variant="ghost" onClick={close} disabled={save.isPending}>
            Cancel
          </Button>
          <p
            key={error ?? showError ?? 'ready'}
            className={cn('gio-swap-in min-w-0 flex-1 truncate font-inter text-[11.5px]', error || showError ? 'text-virgilio-error' : 'text-text-tertiary')}
          >
            {error ?? showError ?? (destinations.length ? `Sends to ${destinationsSentence(destinations)}` : '')}
          </p>
          <Button variant="secondary" icon={Send} onClick={sendTest} disabled={!connected || test.isPending || save.isPending}>
            Send test
          </Button>
          <Button icon={Check} onClick={() => void submit()} loading={save.isPending} className="min-w-[96px]">
            Save
          </Button>
          <UnsavedGuard
            open={asking}
            onKeep={() => setAsking(false)}
            onDiscard={() => {
              setAsking(false)
              onOpenChange(false)
            }}
          />
        </div>
      )}
    >
      {saved && (
        <Tabs value={onHistory ? 'history' : 'automation'} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList indicator="pill" className="mb-4">
            {!readOnly && <TabsTrigger value="automation">Automation</TabsTrigger>}
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {onHistory && saved ? (
        <SlackHistoryPanel automationId={saved.id} />
      ) : (
      <>
      <FormSection title="When" subtitle={isAdmin ? undefined : 'Offer events are for admins.'} bare>
        <div className="flex flex-col gap-3">
          {GROUPS.map((g) => {
            const list = events.filter((e) => e.group === g)
            if (!list.length) return null
            return (
              <div key={g}>
                <p className="mb-1.5 font-inter text-[11.5px] font-medium text-text-tertiary">{g}</p>
                <div role="radiogroup" aria-label={g} className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {list.map((e) => {
                    const on = e.key === event
                    const Icon = e.icon
                    return (
                      <button
                        key={e.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => changeEvent(e.key)}
                        className={cn(
                          'gio-pressable flex min-h-[44px] items-center gap-2.5 rounded-[10px] border bg-white px-3 text-left transition-colors duration-hover',
                          on ? 'border-[#6F3FF5] shadow-[0_0_0_1px_#6F3FF5]' : 'border-[#E7E8EE] hover:border-[#C9C7BF]',
                        )}
                      >
                        <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', on ? 'bg-[#EDE4FF] text-[#6F3FF5]' : 'bg-[#F1F0EC] text-[#5A6072]')}>
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-inter text-[13px] text-text-primary">{e.label}</span>
                        {on && <Check className="h-4 w-4 shrink-0 text-[#6F3FF5]" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        {def.timing && <p className="mt-2 font-inter text-[12px] text-text-tertiary">{def.timing}</p>}
      </FormSection>

      {hasFilters && (
        <FormSection title="Only when" subtitle="Optional. Leave it open to send for everything.">
          <div className="flex flex-wrap items-center gap-2">
            {!jobId && (
              <>
                <FilterChipPopover
                  label="Job"
                  options={(options.data?.jobs ?? []).map((j) => ({ value: j.id, label: j.title, count: 0 }))}
                  selectedValues={filters.job_ids ?? []}
                  onSelectionChange={(v) => setFilters((f) => ({ ...f, job_ids: v }))}
                />
                <FilterChipPopover
                  label="Department"
                  options={(options.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name, count: 0 }))}
                  selectedValues={filters.department_ids ?? []}
                  onSelectionChange={(v) => setFilters((f) => ({ ...f, department_ids: v }))}
                />
                <FilterChipPopover
                  label="Client"
                  options={(options.data?.clients ?? []).map((c) => ({ value: c.id, label: c.name, count: 0 }))}
                  selectedValues={filters.client_ids ?? []}
                  onSelectionChange={(v) => setFilters((f) => ({ ...f, client_ids: v }))}
                />
              </>
            )}
            {def.stages && (
              <FilterChipPopover
                label="Stage"
                options={stageOptions.map((s) => ({ value: s.id, label: s.name, count: 0 }))}
                selectedValues={filters.stage_ids ?? []}
                onSelectionChange={(v) => setFilters((f) => ({ ...f, stage_ids: v }))}
              />
            )}
          </div>
          <p className="mt-2 font-inter text-[12px] text-text-tertiary">{filterSentence(filters, jobId)}</p>
        </FormSection>
      )}

      {def.repeats && (
        <FormSection title="Reminders" subtitle={def.repeats.from}>
          <RemindEvery
            options={def.repeats.options}
            once={def.repeats.once}
            value={every}
            onChange={(d) => setFilters((f) => {
              const { every_days: _every, ...rest } = f
              return d ? { ...rest, every_days: d } : rest
            })}
          />
        </FormSection>
      )}

      <FormSection
        title="Send to"
        subtitle={
          dmOnly
            ? `Only ${dmOnly.who.toLowerCase()}, by DM.`
            : def.people
              ? 'The team member by DM, or channels and people in your Slack.'
              : 'Channels, people in your Slack, or the job\'s people by DM.'
        }
      >
        {dmOnly ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#F1F0EC] px-2.5 font-inter text-[13px] text-text-primary">
              <Users className="h-3.5 w-3.5 text-[#5A6072]" aria-hidden />
              {dmOnly.who}
            </span>
            <span className="inline-flex items-center gap-1 font-inter text-[12px] text-text-tertiary">
              <Lock className="h-3 w-3" aria-hidden />
              {dmOnly.note}
            </span>
          </div>
        ) : (
          <SlackDestinationsField
            value={destinations}
            onChange={setDestinations}
            directory={directory.data}
            loading={directory.isLoading}
            error={directory.isError ? (directory.error as Error).message : null}
            onRetry={() => void directory.refetch()}
            roles={def.roles}
            invalid={!!showError && destinations.length === 0}
          />
        )}
        {!def.dmOnly && (
          <p className="mt-2 font-inter text-[12px] text-text-tertiary">
            A private channel isn&rsquo;t listed? In Slack, type <span className="font-medium text-text-secondary">/invite @Gio</span> in it, then reopen this.
          </p>
        )}
      </FormSection>

      <FormSection title="Message" subtitle="Type { for details and @ to tag someone. People in details are tagged when Slack knows them.">
        <SlackMessageBox
          id="slack-message"
          value={draft}
          onChange={setDraft}
          users={directory.data?.users ?? []}
          usersLoading={directory.isLoading}
          picked={picked}
          onPick={(t) => setPicked((p) => (p.some((x) => x.id === t.id) ? p : [...p, t]))}
          details={def.details}
          invalid={!!showError && (!draft.trim() || pay)}
          describedBy="slack-message-hint"
          onReady={(insert) => (insertRef.current = insert)}
        />
        <CharCounterLine count={draft.length} max={MAX} className="mt-1">
          <span id="slack-message-hint" className={cn('font-inter text-[11.5px]', pay || unknown.length ? 'text-[#B42318]' : 'text-text-tertiary')}>
            {pay
              ? 'Pay never goes to Slack. Take that detail out.'
              : unknown.length
                ? `${unknown.map((k) => `{${k}}`).join(', ')} ${unknown.length === 1 ? 'isn’t' : 'aren’t'} filled for this event; Slack shows a dash.`
                : ''}
          </span>
        </CharCounterLine>
        <div className="mt-2 flex flex-wrap gap-1">
          {def.details.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => insertRef.current?.(`{${k}}`)}
              className="gio-pressable inline-flex h-6 items-center gap-1 rounded-md bg-[#F1F0EC] px-2 font-inter text-[11.5px] text-text-secondary transition-colors duration-hover hover:bg-[#E9E7E1] hover:text-text-primary"
            >
              {LINK_DETAILS.has(k) && <Link2 aria-hidden className="h-3 w-3" strokeWidth={2} />}
              {SLACK_DETAILS[k].label}
            </button>
          ))}
        </div>
      </FormSection>

      <FormSection title="Preview" subtitle="With example details." bare>
        <SlackPreview
          message={draft}
          picked={picked}
          details={def.details}
          people={def.people}
          event={event}
          dm={!!def.dmOnly || (destinations.length > 0 && destinations.every((d) => d.type === 'role' && (d.role === 'interviewer' || d.role === 'member')))}
        />
      </FormSection>

      <FormSection title="Name" subtitle={`Optional. Shown in the list instead of “${def.when}”.`}>
        <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={def.when} aria-label="Name" />
      </FormSection>
      </>
      )}
      {saved && canSendNow(saved) && (
        <SendNowDialog open={sendingNow} onOpenChange={setSendingNow} tenantId={tenantId} automation={saved} />
      )}
    </FormSheet>
  )
}

function cleanFilters(f: SlackFilters): SlackFilters {
  const out: SlackFilters = {}
  for (const k of ['job_ids', 'department_ids', 'client_ids', 'stage_ids'] as const) {
    const v = f[k]
    if (v && v.length) out[k] = v
  }
  if (f.every_days) out.every_days = f.every_days
  return out
}

/** How often (the event's own choices, and "Only once" where it may): one
 * layer slides between them (§14). 0 is only once. */
function RemindEvery({ options, once, value, onChange }: {
  options: readonly number[]
  once?: boolean
  value: number
  onChange: (days: number) => void
}) {
  const segRef = useSegmentLayer<HTMLDivElement>()
  return (
    <div
      ref={segRef}
      role="radiogroup"
      aria-label="Reminders"
      className="gio-seg inline-flex"
      style={{ gap: 4, padding: 4, background: '#ECEAE2', borderRadius: 10 }}
    >
      {[...options, ...(once ? [0] : [])].map((d) => {
        const active = d === value
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            data-seg-option
            data-active={active || undefined}
            onClick={() => onChange(d)}
            className="inline-flex items-center font-poppins tabular-nums"
            style={{
              padding: '7px 13px',
              borderRadius: 7,
              border: 'none',
              fontSize: 12,
              letterSpacing: '-0.01em',
              fontWeight: active ? 600 : 500,
              color: active ? '#1F2230' : '#5A6072',
              background: 'transparent',
              transition: 'color var(--dur-hover) ease',
              cursor: 'pointer',
            }}
          >
            {d === 0 ? 'Only once' : d === 1 ? 'Every day' : `Every ${d} days`}
          </button>
        )
      })}
      <SegmentLayer fill="#fff" shadow="0 1px 2px rgba(13,13,9,.12)" />
    </div>
  )
}

function filterSentence(f: SlackFilters, jobId: string | null): string {
  const bits: string[] = []
  const n = (list: string[] | undefined, one: string, many: string) =>
    list && list.length ? (list.length === 1 ? `1 ${one}` : `${list.length} ${many}`) : null
  const jobs = n(f.job_ids, 'job', 'jobs')
  const deps = n(f.department_ids, 'department', 'departments')
  const clients = n(f.client_ids, 'client', 'clients')
  const stages = n(f.stage_ids, 'stage', 'stages')
  if (jobs) bits.push(jobs)
  if (deps) bits.push(deps)
  if (clients) bits.push(clients)
  if (stages) bits.push(stages)
  if (!bits.length) return jobId ? 'Any stage of this job.' : 'Every job, every stage.'
  return `Only for ${bits.join(' · ')}.`
}
