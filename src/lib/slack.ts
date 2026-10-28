/**
 * Slack (2026-10-27): connect the workspace's Slack and send messages when
 * things happen. "When X, send Y to Z": an event, an optional filter, where it
 * goes (channels, Slack people, or the job's people by DM) and a message with
 * {details} and Slack @tags. The database queues and the slack-deliver Edge
 * Function writes and sends; screens only read and save through the slack_*
 * functions (who may do what is the database's call).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase, CalendarClock, CalendarX2, CheckCircle2, ClipboardCheck, ClipboardList, FileCheck2, FileSignature,
  FileX2, Hourglass, Inbox, ListTodo, MoveRight, PartyPopper, Send, UserPlus, UserX, XCircle, type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'

// ---------- Events ----------

export type SlackEvent =
  | 'candidate.applied' | 'candidate.stage_changed' | 'candidate.hired' | 'candidate.rejected'
  | 'interview.scheduled' | 'interview.cancelled' | 'scorecard.submitted' | 'scorecard.due'
  | 'offer.approval_requested' | 'offer.approval_waiting' | 'offer.approved' | 'offer.sent' | 'offer.signed' | 'offer.declined'
  | 'job.opened' | 'job.closed'
  | 'member.joined' | 'member.profile_incomplete'

export type SlackDetail =
  | 'who' | 'candidate' | 'job' | 'client' | 'department' | 'stage' | 'previous_stage'
  | 'recruiter' | 'sourcer' | 'hiring_manager' | 'interviewer' | 'interview_time'
  | 'rating' | 'reason' | 'opening' | 'approver' | 'approval_step' | 'waiting'
  | 'member' | 'missing' | 'progress'
  // Links (2026-10-28): each reads as a labelled link in Slack.
  | 'profile_link' | 'offer_link' | 'scorecard_link' | 'job_link' | 'pipeline_link' | 'my_profile_link'

export type SlackRole = 'recruiter' | 'sourcer' | 'hiring_manager' | 'interviewer' | 'approver' | 'member'

export interface SlackEventDef {
  key: SlackEvent
  group: 'Candidates' | 'Interviews' | 'Offers' | 'Jobs' | 'People'
  label: string
  /** "When …" */
  when: string
  icon: LucideIcon
  /** Admins only (a channel can hold anyone). */
  offer?: boolean
  /** The details this event can fill. */
  details: SlackDetail[]
  /** The job's people this event can DM. */
  roles: SlackRole[]
  /** The stage filter applies. */
  stages?: boolean
  /** People (2026-10-28): Virgilio's own team members, workspace-wide, admins
   * only, no job filters. */
  people?: boolean
  /** Goes only to this person, by DM (the team member, the approver whose
   * turn it is, the interviewer who owes a scorecard). */
  dmOnly?: SlackRole
  /** Repeats every `filters.every_days` until it no longer applies: the
   * choices, the default, whether "Only once" is one, and from when. */
  repeats?: { options: readonly number[]; initial: number; once?: boolean; from: string }
  message: string
}

const JOB_PEOPLE: SlackDetail[] = ['recruiter', 'sourcer', 'hiring_manager']
const CANDIDATE: SlackDetail[] = ['who', 'candidate', 'job', 'client', 'department', 'stage', ...JOB_PEOPLE]
// The links each kind of event can carry (the server's messageLinks).
const JOB_LINKS: SlackDetail[] = ['job_link', 'pipeline_link']
const CANDIDATE_LINKS: SlackDetail[] = ['profile_link', ...JOB_LINKS]
const SCORECARD_LINKS: SlackDetail[] = ['profile_link', 'scorecard_link', ...JOB_LINKS]
const OFFER_LINKS: SlackDetail[] = ['profile_link', 'offer_link', ...JOB_LINKS]
const TEAM: SlackRole[] = ['recruiter', 'sourcer', 'hiring_manager']

export const SLACK_EVENTS: SlackEventDef[] = [
  { key: 'candidate.applied', group: 'Candidates', label: 'Someone applies', when: 'When someone applies', icon: Inbox,
    details: ['candidate', 'job', 'client', 'department', ...JOB_PEOPLE, ...CANDIDATE_LINKS], roles: TEAM,
    message: '{candidate} applied to {job}.' },
  { key: 'candidate.stage_changed', group: 'Candidates', label: 'A candidate moves stage', when: 'When a candidate moves stage', icon: MoveRight,
    details: [...CANDIDATE, 'previous_stage', ...CANDIDATE_LINKS], roles: TEAM, stages: true,
    message: '{who} moved {candidate} to {stage} on {job}.' },
  { key: 'candidate.hired', group: 'Candidates', label: 'A candidate is hired', when: 'When a candidate is hired', icon: PartyPopper,
    details: [...CANDIDATE, 'opening', ...CANDIDATE_LINKS], roles: TEAM,
    message: '{who} just hired {candidate} for {client} ({job}).' },
  { key: 'candidate.rejected', group: 'Candidates', label: 'A candidate is rejected', when: 'When a candidate is rejected', icon: UserX,
    details: [...CANDIDATE, 'reason', ...CANDIDATE_LINKS], roles: TEAM, stages: true,
    message: '{candidate} was rejected from {job}: {reason}.' },
  { key: 'interview.scheduled', group: 'Interviews', label: 'An interview is scheduled', when: 'When an interview is scheduled', icon: CalendarClock,
    details: [...CANDIDATE, 'interviewer', 'interview_time', ...SCORECARD_LINKS], roles: [...TEAM, 'interviewer'], stages: true,
    message: '{who} scheduled {candidate} with {interviewer} for {interview_time} ({job}).' },
  { key: 'interview.cancelled', group: 'Interviews', label: 'An interview is cancelled', when: 'When an interview is cancelled', icon: CalendarX2,
    details: [...CANDIDATE, 'interviewer', 'interview_time', ...SCORECARD_LINKS], roles: [...TEAM, 'interviewer'], stages: true,
    message: 'The interview with {candidate} on {interview_time} was cancelled ({job}).' },
  { key: 'scorecard.submitted', group: 'Interviews', label: 'A scorecard is submitted', when: 'When a scorecard is submitted', icon: ClipboardCheck,
    details: [...CANDIDATE, 'rating', ...SCORECARD_LINKS], roles: TEAM, stages: true,
    message: '{who} submitted a scorecard for {candidate}: {rating}.' },
  { key: 'scorecard.due', group: 'Interviews', label: 'A scorecard is due', when: 'When a scorecard is due', icon: ClipboardList,
    details: ['candidate', 'job', 'client', 'department', 'stage', 'interviewer', 'interview_time', ...SCORECARD_LINKS],
    roles: ['interviewer'], stages: true, dmOnly: 'interviewer',
    repeats: { options: [1, 2, 3], initial: 1, once: true, from: 'From when the interview ends, until their scorecard is in.' },
    message: 'Hi {interviewer}! 👋 Your scorecard for {candidate} ({job}, {stage}) is due. A few minutes now keeps the process moving. {scorecard_link}' },
  { key: 'offer.approval_requested', group: 'Offers', label: 'An offer needs approval', when: 'When an offer is sent for approval', icon: FileCheck2, offer: true,
    details: ['who', 'candidate', 'job', 'client', 'department', ...JOB_PEOPLE, 'approver', 'approval_step', ...OFFER_LINKS],
    roles: [...TEAM, 'approver'],
    message: "{who} sent {candidate}'s offer for {job} for approval. Next to approve: {approver}." },
  { key: 'offer.approval_waiting', group: 'Offers', label: 'An offer is still waiting for approval', when: 'When an offer is still waiting for approval', icon: Hourglass, offer: true,
    details: ['candidate', 'job', 'client', 'department', ...JOB_PEOPLE, 'approver', 'approval_step', 'waiting', ...OFFER_LINKS],
    roles: ['approver'], dmOnly: 'approver',
    repeats: { options: [1, 2, 3], initial: 1, from: 'From when their turn began, until they decide.' },
    message: 'Hi {approver}! 👋 The offer for {candidate} ({job}) is still waiting for your approval. It can’t go out until you decide. {offer_link}' },
  { key: 'offer.approved', group: 'Offers', label: 'An offer is approved', when: 'When an offer is approved', icon: CheckCircle2, offer: true,
    details: ['who', 'candidate', 'job', 'client', 'department', ...JOB_PEOPLE, ...OFFER_LINKS], roles: TEAM,
    message: "{candidate}'s offer for {job} is approved." },
  { key: 'offer.sent', group: 'Offers', label: 'An offer is sent to sign', when: 'When an offer is sent to sign', icon: Send, offer: true,
    details: ['who', 'candidate', 'job', 'client', 'department', ...JOB_PEOPLE, ...OFFER_LINKS], roles: TEAM,
    message: '{who} sent {candidate} their offer for {job}.' },
  { key: 'offer.signed', group: 'Offers', label: 'An offer is signed', when: 'When an offer is signed', icon: FileSignature, offer: true,
    details: ['candidate', 'job', 'client', 'department', ...JOB_PEOPLE, ...OFFER_LINKS], roles: TEAM,
    message: '{candidate} signed their offer for {job}.' },
  { key: 'offer.declined', group: 'Offers', label: 'An offer is declined', when: 'When an offer is declined', icon: FileX2, offer: true,
    details: ['candidate', 'job', 'client', 'department', ...JOB_PEOPLE, ...OFFER_LINKS], roles: TEAM,
    message: '{candidate} declined their offer for {job}.' },
  { key: 'job.opened', group: 'Jobs', label: 'A job opens', when: 'When a job opens', icon: Briefcase,
    details: ['who', 'job', 'client', 'department', ...JOB_PEOPLE, ...JOB_LINKS], roles: TEAM,
    message: '{who} opened {job} for {client}.' },
  { key: 'job.closed', group: 'Jobs', label: 'A job closes', when: 'When a job closes', icon: XCircle,
    details: ['who', 'job', 'client', 'department', ...JOB_PEOPLE, ...JOB_LINKS], roles: TEAM,
    message: '{job} for {client} is closed.' },
  { key: 'member.joined', group: 'People', label: 'Someone joins Gio ATS', when: 'When someone joins Gio ATS', icon: UserPlus, people: true,
    details: ['member', 'my_profile_link'], roles: ['member'],
    message: 'Welcome to Gio, {member}! 👋🎉 We’re so happy you’re here. Start with your profile: it only takes a few minutes ✨' },
  { key: 'member.profile_incomplete', group: 'People', label: 'A profile is still incomplete', when: 'When a profile is still incomplete', icon: ListTodo,
    people: true, dmOnly: 'member',
    repeats: { options: [3, 5, 7, 14], initial: 7, from: 'From the day they join, until their profile is complete.' },
    details: ['member', 'missing', 'progress', 'my_profile_link'], roles: ['member'],
    message: 'Hey {member}! 👋 Your Gio profile is {progress}. Still to add: {missing}. It only takes a few minutes, and it helps the whole team ✨' },
]

export const SLACK_EVENT = Object.fromEntries(SLACK_EVENTS.map((e) => [e.key, e])) as Record<SlackEvent, SlackEventDef>

export const SLACK_DETAILS: Record<SlackDetail, { label: string; example: string }> = {
  who: { label: 'Who did it', example: 'Victoria Bravo' },
  candidate: { label: 'Candidate', example: 'Ana Torres' },
  job: { label: 'Job', example: 'Senior Account Executive' },
  client: { label: 'Client', example: 'Acme' },
  department: { label: 'Department', example: 'Sales' },
  stage: { label: 'Stage', example: 'Hiring manager interview' },
  previous_stage: { label: 'Previous stage', example: 'Recruiter screen' },
  recruiter: { label: 'Recruiter', example: 'Victoria Bravo' },
  sourcer: { label: 'Sourcer', example: 'Ritika S.' },
  hiring_manager: { label: 'Hiring manager', example: 'Erik Veen' },
  interviewer: { label: 'Interviewer', example: 'Jurre Veen' },
  interview_time: { label: 'Interview time', example: 'Thu, Oct 30 at 11:00' },
  rating: { label: 'Rating', example: 'Strong yes' },
  reason: { label: 'Rejection reason', example: 'Not enough experience' },
  opening: { label: 'Opening (Req ID)', example: 'REQ-0042' },
  approver: { label: 'Approver (whose turn)', example: 'Erik Veen' },
  approval_step: { label: 'Approval step', example: 'Step 2 of 3' },
  waiting: { label: 'Waiting for', example: '2 days' },
  member: { label: 'Team member', example: 'Sofía Ramírez' },
  missing: { label: 'What’s missing', example: 'birthday, tax ID and bank details' },
  progress: { label: 'Progress', example: '3 of 6 done' },
  profile_link: { label: 'Link to their profile', example: 'Opens the candidate in this job' },
  offer_link: { label: 'Link to the offer', example: 'Opens the Offer tab' },
  scorecard_link: { label: 'Link to the scorecards', example: 'Opens the Scorecards tab' },
  job_link: { label: 'Link to the job', example: 'Opens the job page' },
  pipeline_link: { label: 'Link to the pipeline', example: 'Opens the job’s pipeline' },
  my_profile_link: { label: 'Link to their own profile', example: 'Opens My profile for whoever clicks it' },
}

/** Details that become a labelled link in Slack. */
export const LINK_DETAILS = new Set<SlackDetail>(['profile_link', 'offer_link', 'scorecard_link', 'job_link', 'pipeline_link', 'my_profile_link'])

/** The words a link reads as in Slack (the server's messageLinks). */
export function linkLabel(key: SlackDetail, event: SlackEvent | null | undefined): string {
  switch (key) {
    case 'profile_link': return `Open ${SLACK_DETAILS.candidate.example}'s profile`
    case 'offer_link': return event === 'offer.approval_requested' || event === 'offer.approval_waiting' ? 'Review the offer' : 'See the offer'
    case 'scorecard_link':
      return event === 'scorecard.submitted' ? 'Read the scorecard' : event === 'scorecard.due' ? 'Open your scorecard' : 'Open the scorecards'
    case 'job_link': return 'Open the job'
    case 'pipeline_link': return 'See the pipeline'
    case 'my_profile_link': return event === 'member.profile_incomplete' ? 'Finish your profile' : 'Open your profile'
    default: return SLACK_DETAILS[key].label
  }
}

/** Where a message's own "Open" link goes and what it reads as (the server's
 * openLink), as seen by someone it DMs. Null: no link (a welcome in a channel). */
export function openLabel(event: SlackEvent | null | undefined, dm = false): { label: string; where: string } | null {
  switch (event) {
    case 'member.joined': return dm ? { label: 'Open your profile', where: 'My profile' } : null
    case 'member.profile_incomplete': return { label: 'Finish your profile', where: 'the first card still to fill in on My profile' }
    case 'offer.approval_requested': return { label: 'Review the offer', where: 'the approval, at whose turn it is' }
    case 'offer.approval_waiting': return { label: 'Review the offer', where: 'their Approve / Decline row' }
    case 'scorecard.due': return { label: 'Open your scorecard', where: 'their own scorecard, ready to fill in' }
    case 'offer.approved': case 'offer.sent': case 'offer.signed': case 'offer.declined':
      return { label: 'See the offer', where: 'the Offer tab' }
    case 'interview.scheduled':
      return dm ? { label: 'Open your scorecard', where: 'the interviewer’s own scorecard' } : { label: 'Open the scorecards', where: 'the Scorecards tab' }
    case 'interview.cancelled': return { label: 'Open the scorecards', where: 'the Scorecards tab' }
    case 'scorecard.submitted': return { label: 'Read the scorecard', where: 'the Scorecards tab' }
    case 'candidate.hired': return { label: `Open ${SLACK_DETAILS.candidate.example}'s profile`, where: 'Onboarding' }
    case 'candidate.rejected': return { label: `Open ${SLACK_DETAILS.candidate.example}'s profile`, where: 'Rejection details' }
    case 'job.opened': case 'job.closed': return { label: 'Open the job', where: 'the job page' }
    default: return { label: `Open ${SLACK_DETAILS.candidate.example}'s profile`, where: 'the candidate in this job' }
  }
}

/** Details a person may click that become an @mention in Slack. */
export const PERSON_DETAILS = new Set<SlackDetail>(['who', 'recruiter', 'sourcer', 'hiring_manager', 'interviewer', 'approver', 'member'])

export const ROLE_LABEL: Record<SlackRole, string> = {
  recruiter: 'Recruiter',
  sourcer: 'Sourcer',
  hiring_manager: 'Hiring manager',
  interviewer: 'Interviewer',
  approver: 'Offer approver',
  member: 'Team member',
}

/** A second line for a role in the Send to menu, when it needs one. */
export const ROLE_HINT: Partial<Record<SlackRole, string>> = {
  approver: 'Whoever’s turn it is, one at a time',
  member: 'The person it’s about, by DM',
}


// ---------- Shapes ----------

export type SlackDestination =
  | { type: 'channel'; id: string; name: string }
  | { type: 'user'; id: string; name: string }
  | { type: 'role'; role: SlackRole }

export interface SlackFilters {
  job_ids?: string[]
  department_ids?: string[]
  client_ids?: string[]
  stage_ids?: string[]
  /** Profile reminders: every 3, 5, 7 or 14 days. */
  every_days?: number
}

export interface SlackStatus {
  connected: boolean
  is_admin: boolean
  can_edit_jobs: boolean
  automations: number
  status?: 'active' | 'broken'
  status_detail?: string | null
  team_id?: string
  team_name?: string
  team_domain?: string | null
  team_icon?: string | null
  bot_user_id?: string
  connected_at?: string
  connected_by?: string | null
}

export interface SlackAutomation {
  id: string
  job_id: string | null
  job_title: string | null
  name: string | null
  event: SlackEvent
  filters: SlackFilters
  destinations: SlackDestination[]
  message: string
  is_active: boolean
  preset: string | null
  created_by_name: string | null
  updated_at: string
  last_sent_at: string | null
  last_error: string | null
  last_error_at: string | null
  can_edit: boolean
}

export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_member: boolean
}

export interface SlackUser {
  id: string
  name: string
  handle: string
  title: string | null
  avatar: string | null
}

export interface SlackDirectory {
  channels: SlackChannel[]
  users: SlackUser[]
}

// ---------- Messages: "@Name" in the box, <@ID> in the database ----------

export interface SlackTag {
  id: string
  name: string
}

function plainTag(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`@${escaped}(?![\\p{L}\\p{N}])`, 'gu')
}

/** The picked Slack people whose "@Name" is still in the draft. */
export function slackTagsIn(draft: string, picked: SlackTag[]): SlackTag[] {
  const seen = new Set<string>()
  return picked.filter((p) => {
    if (seen.has(p.id)) return false
    const found = plainTag(p.name).test(draft)
    if (found) seen.add(p.id)
    return found
  })
}

/** The draft as saved: every picked "@Name" becomes <@ID>. */
export function encodeSlackMessage(draft: string, picked: SlackTag[]): string {
  const people = slackTagsIn(draft, picked).sort((a, b) => b.name.length - a.name.length)
  let out = draft
  for (const p of people) out = out.replace(plainTag(p.name), `<@${p.id}>`)
  return out
}

/** A saved message as the box shows it: <@ID> back to "@Name" (or "@someone" for a person who left). */
export function decodeSlackMessage(saved: string, users: SlackUser[]): { draft: string; picked: SlackTag[] } {
  const byId = new Map(users.map((u) => [u.id, u]))
  const picked: SlackTag[] = []
  const draft = saved.replace(/<@([UW][A-Z0-9]+)>/g, (_whole, id: string) => {
    const u = byId.get(id)
    if (!u) return `<@${id}>`
    if (!picked.some((p) => p.id === id)) picked.push({ id, name: u.name })
    return `@${u.name}`
  })
  return { draft, picked }
}

/** {details} in a message that this event can't fill. */
export function unknownDetails(message: string, event: SlackEvent): string[] {
  const allowed = new Set(SLACK_EVENT[event]?.details ?? [])
  const out: string[] = []
  for (const m of message.matchAll(/\{\s*([a-z_]+)\s*\}/g)) {
    const k = m[1] as SlackDetail
    if (k in SLACK_DETAILS && !allowed.has(k) && !out.includes(k)) out.push(k)
  }
  return out
}

/** Pay never goes to Slack (the database refuses it too). */
export function asksForPay(message: string): boolean {
  return /\{\s*(salary|pay|compensation|amount|bonus|equity)/i.test(message)
}

export function destinationLabel(d: SlackDestination): string {
  if (d.type === 'channel') return `#${d.name}`
  if (d.type === 'user') return d.name
  return `The ${ROLE_LABEL[d.role].toLowerCase()}`
}

/** One line for a list row: "#hiring, Allan Bravo and the recruiter". */
export function destinationsSentence(list: SlackDestination[]): string {
  // Always mid-sentence ("Sends to …", "Check … in Slack"), so "the recruiter".
  const names = list.map((d) =>
    (destinationLabel(d) + (d.type === 'role' && d.role === 'approver' ? ' on their turn' : '')).replace(/^The /, 'the '),
  )
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

// ---------- Queries ----------

const statusKey = (tenantId?: string) => ['slack-status', tenantId] as const
const listKey = (tenantId?: string, jobId?: string | null) => ['slack-automations', tenantId, jobId ?? null] as const

export function useSlackStatus(tenantId: string | undefined) {
  return useQuery({
    queryKey: statusKey(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('slack_status', { _tenant: tenantId })
      if (error) throw error
      return data as unknown as SlackStatus
    },
  })
}

export function useSlackAutomations(tenantId: string | undefined, jobId?: string | null, enabled = true) {
  return useQuery({
    queryKey: listKey(tenantId, jobId),
    enabled: !!tenantId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('slack_automations_list', { _tenant: tenantId, _job: jobId ?? null })
      if (error) throw error
      return (data ?? []) as unknown as SlackAutomation[]
    },
  })
}

async function invokeSlack<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('slack', { body })
  if (error) {
    // The function's own words when it sent them.
    const ctx = (error as { context?: Response })?.context
    let message = 'Slack didn’t answer. Try again.'
    try {
      const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null
      if (j?.error) message = j.error
    } catch {
      // keep the plain message
    }
    throw new Error(message)
  }
  return data as T
}

export function useSlackDirectory(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['slack-directory', tenantId],
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => invokeSlack<SlackDirectory>({ action: 'directory', tenant_id: tenantId }),
  })
}

export async function startSlackConnect(tenantId: string) {
  const { url } = await invokeSlack<{ url: string }>({
    action: 'start', tenant_id: tenantId, return_origin: window.location.origin,
  })
  window.location.assign(url)
}

export function useDisconnectSlack(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => invokeSlack<{ ok: true }>({ action: 'disconnect', tenant_id: tenantId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slack-status'] })
      qc.invalidateQueries({ queryKey: ['slack-automations'] })
      qc.removeQueries({ queryKey: ['slack-directory'] })
    },
  })
}

export interface SlackTestResult {
  to: string
  ok: boolean
  problem?: string
}

export function useSlackTest(tenantId: string | undefined) {
  return useMutation({
    mutationFn: (input: { job_id: string | null; event: SlackEvent; message: string; destinations: SlackDestination[] }) =>
      invokeSlack<{ results: SlackTestResult[] }>({ action: 'test', tenant_id: tenantId, ...input }),
  })
}

export interface SaveAutomationInput {
  id: string | null
  job_id: string | null
  name: string | null
  event: SlackEvent
  filters: SlackFilters
  destinations: SlackDestination[]
  message: string
  is_active?: boolean
  preset?: string | null
}

function dbError(error: { message?: string; code?: string } | null, fallback: string): Error {
  if (error?.code?.startsWith('GSL') && error.message) return new Error(error.message)
  return new Error(fallback)
}

export function useSaveSlackAutomation(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveAutomationInput) => {
      const { data, error } = await supabase.rpc('slack_save_automation', {
        _id: input.id,
        _tenant: tenantId,
        _job: input.job_id,
        _name: input.name,
        _event: input.event,
        _filters: input.filters as Json,
        _destinations: input.destinations as unknown as Json,
        _message: input.message,
        _is_active: input.is_active ?? true,
        _preset: input.preset ?? null,
      })
      if (error) throw dbError(error, 'Couldn’t save the automation. Try again.')
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slack-automations', tenantId] })
      qc.invalidateQueries({ queryKey: statusKey(tenantId) })
    },
  })
}

/** On/off and remove/restore, optimistic in every list that shows the row. */
export function useSetSlackAutomation(tenantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; active?: boolean; removed?: boolean }) => {
      const { error } = await supabase.rpc('slack_set_automation', {
        _id: input.id, _active: input.active ?? null, _removed: input.removed ?? null,
      })
      if (error) throw dbError(error, 'Couldn’t change the automation. Try again.')
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['slack-automations', tenantId] })
      const before = qc.getQueriesData<SlackAutomation[]>({ queryKey: ['slack-automations', tenantId] })
      for (const [key, rows] of before) {
        if (!rows) continue
        qc.setQueryData<SlackAutomation[]>(key, input.removed === true
          ? rows.filter((r) => r.id !== input.id)
          : rows.map((r) => (r.id === input.id && input.active !== undefined ? { ...r, is_active: input.active } : r)))
      }
      return { before }
    },
    onError: (_e, _input, ctx) => {
      for (const [key, rows] of ctx?.before ?? []) qc.setQueryData(key, rows)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['slack-automations', tenantId] })
      qc.invalidateQueries({ queryKey: statusKey(tenantId) })
    },
  })
}

// ---------- What the filters can pick ----------

export interface SlackFilterOptions {
  jobs: Array<{ id: string; title: string }>
  departments: Array<{ id: string; name: string }>
  clients: Array<{ id: string; name: string }>
  stages: Array<{ id: string; name: string }>
}

export function useSlackFilterOptions(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['slack-filter-options', tenantId],
    enabled: !!tenantId && enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SlackFilterOptions> => {
      const [jobs, departments, clients, stages] = await Promise.all([
        supabase.from('jobs').select('id, title').eq('tenant_id', tenantId!).is('deleted_at', null)
          .in('status', ['draft', 'open']).order('title').limit(500),
        supabase.from('departments').select('id, name').eq('tenant_id', tenantId!).eq('is_archived', false).order('name'),
        supabase.from('organizations').select('id, name').eq('tenant_id', tenantId!).eq('org_kind', 'client').order('name').limit(500),
        supabase.from('job_stages').select('id, stage_name, tenant_id, is_active').eq('is_active', true)
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`).order('stage_priority'),
      ])
      const err = jobs.error ?? departments.error ?? clients.error ?? stages.error
      if (err) throw err
      return {
        jobs: (jobs.data ?? []).map((j) => ({ id: j.id, title: j.title })),
        departments: (departments.data ?? []).map((d) => ({ id: d.id, name: d.name })),
        clients: (clients.data ?? []).map((c) => ({ id: c.id, name: c.name })),
        stages: (stages.data ?? []).map((s) => ({ id: s.id, name: s.stage_name })),
      }
    },
  })
}

/** A job's own stages, by their library stage (what the stage filter matches). */
export function useJobStageOptions(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['slack-job-stages', jobId],
    enabled: !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_hiring_stages')
        .select('stage_id, custom_stage_name, position, job_stages(stage_name)')
        .eq('job_id', jobId!)
        .order('position')
      if (error) throw error
      const seen = new Set<string>()
      const out: Array<{ id: string; name: string }> = []
      for (const r of (data ?? []) as Array<{ stage_id: string | null; custom_stage_name: string | null; job_stages: { stage_name: string } | null }>) {
        if (!r.stage_id || seen.has(r.stage_id)) continue
        seen.add(r.stage_id)
        out.push({ id: r.stage_id, name: r.custom_stage_name?.trim() || r.job_stages?.stage_name || 'Stage' })
      }
      return out
    },
  })
}

/**
 * The job wizard's "Tell the hiring team in Slack": DM the Recruiter and
 * Hiring manager when someone applies, and the Recruiter, Sourcer and Hiring
 * manager when someone is hired. Two ordinary job automations (editable in the
 * job's Setup › Slack), marked with their preset.
 */
export async function addHiringTeamPresets(tenantId: string, jobId: string) {
  const presets: Array<{ preset: string; event: SlackEvent; destinations: SlackDestination[] }> = [
    { preset: 'team-applied', event: 'candidate.applied', destinations: [{ type: 'role', role: 'recruiter' }, { type: 'role', role: 'hiring_manager' }] },
    { preset: 'team-hired', event: 'candidate.hired', destinations: [{ type: 'role', role: 'recruiter' }, { type: 'role', role: 'sourcer' }, { type: 'role', role: 'hiring_manager' }] },
  ]
  for (const p of presets) {
    const { error } = await supabase.rpc('slack_save_automation', {
      _id: null,
      _tenant: tenantId,
      _job: jobId,
      _name: null,
      _event: p.event,
      _filters: {},
      _destinations: p.destinations as unknown as Json,
      _message: SLACK_EVENT[p.event].message,
      _is_active: true,
      _preset: p.preset,
    })
    if (error) throw dbError(error, 'Couldn’t add the Slack messages.')
  }
}
