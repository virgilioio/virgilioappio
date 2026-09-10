/**
 * Stage automations — shared vocabulary.
 * WHEN {trigger} · DO {action} · {timing} · guardrails.
 * The list renders the sentence; the builder writes it in that order.
 */
import {
  Mail, Layers, MessageSquare, CalendarClock, FileText,
  Bell, CheckSquare, ClipboardCheck, UserPlus,
  ArrowRightCircle, XCircle, Tag, Users, ShieldCheck, Webhook,
  type LucideIcon,
} from 'lucide-react'

export type AutomationAction =
  | 'email' | 'sequence' | 'chat' | 'scheduling' | 'documents'
  | 'notify' | 'task' | 'scorecard' | 'assign'
  | 'move' | 'reject' | 'tag' | 'pool' | 'reference' | 'webhook'

export type AutomationTrigger =
  | 'enter' | 'exit' | 'idle' | 'noreply' | 'replied'
  | 'scheduled' | 'completed' | 'scorecard' | 'allscorecards' | 'rejected'

export type AutomationTiming = 'immediate' | 'delay' | 'at_time'
export type DelayUnit = 'hours' | 'days' | 'business_days'
export type ActionFamily = 'candidate' | 'team' | 'pipeline'

export interface AttachmentRef {
  file_id: string
  name: string
  size: number
  content_type?: string
}

export interface AutomationEmailStep {
  subject: string
  body_html: string
  attachments: AttachmentRef[]
  /** Days after the previous step (0 for the first). */
  delay_days: number
}

export interface EmailConfig {
  from: string
  cc: string[]
  bcc: string[]
  template_id: string | null
  emails: AutomationEmailStep[]
}

export interface GenericConfig {
  recipients?: string[]
  channels?: Array<'in_app' | 'email' | 'slack'>
  message?: string
  assignee?: string | null
  due_offset_days?: number
  target_stage_id?: string | null
  tag_id?: string | null
  pool_id?: string | null
  url?: string
  secret?: string
  role?: string
}

export type AutomationConfig = Partial<EmailConfig & GenericConfig>

export interface ActionDef {
  key: AutomationAction
  family: ActionFamily
  label: string
  description: string
  icon: LucideIcon
  /** Tinted tile colours */
  bg: string
  fg: string
  /** Not yet executable by the engine — shown but not selectable. */
  soon?: boolean
}

// Tile palette per family / sub-family (spec)
const CANDIDATE = { bg: '#EFE9FE', fg: '#6F3FF5' }
const CANDIDATE_ALT = { bg: '#E3F4FD', fg: '#0EA5E9' }
const TEAM = { bg: '#FBF0DF', fg: '#E0891A' }
const MOVE = { bg: '#E4F5EA', fg: '#12B886' }
const REJECT = { bg: '#FDECEC', fg: '#FA5252' }
const NEUTRAL = { bg: '#F1F0EC', fg: '#5A6072' }

export const ACTIONS: ActionDef[] = [
  { key: 'email', family: 'candidate', label: 'Send an email', description: 'One message from your connected mailbox.', icon: Mail, ...CANDIDATE },
  { key: 'sequence', family: 'candidate', label: 'Email sequence', description: 'Several emails, spaced out over days.', icon: Layers, ...CANDIDATE },
  { key: 'chat', family: 'candidate', label: 'Send a chat message', description: 'Post to the candidate portal thread.', icon: MessageSquare, ...CANDIDATE_ALT, soon: true },
  { key: 'scheduling', family: 'candidate', label: 'Send a scheduling link', description: 'Invite them to pick an interview slot.', icon: CalendarClock, ...CANDIDATE_ALT, soon: true },
  { key: 'documents', family: 'candidate', label: 'Request documents', description: 'Ask for ID, portfolio or references.', icon: FileText, ...CANDIDATE_ALT, soon: true },

  { key: 'notify', family: 'team', label: 'Notify the team', description: 'Ping recruiters or the hiring team in-app.', icon: Bell, ...TEAM },
  { key: 'task', family: 'team', label: 'Create a task', description: 'A reminder with a due date for someone.', icon: CheckSquare, ...TEAM },
  { key: 'scorecard', family: 'team', label: 'Request a scorecard', description: 'Nudge the stage interviewers to submit.', icon: ClipboardCheck, ...TEAM },
  { key: 'assign', family: 'team', label: 'Assign a reviewer', description: 'Add someone to this stage\'s interviewers.', icon: UserPlus, ...TEAM },

  { key: 'move', family: 'pipeline', label: 'Move to another stage', description: 'Advance or send back automatically.', icon: ArrowRightCircle, ...MOVE },
  { key: 'reject', family: 'pipeline', label: 'Reject the candidate', description: 'Mark as rejected on this job.', icon: XCircle, ...REJECT },
  { key: 'tag', family: 'pipeline', label: 'Add a tag', description: 'Label the candidate\'s profile.', icon: Tag, ...NEUTRAL },
  { key: 'pool', family: 'pipeline', label: 'Add to a talent pool', description: 'Keep them in a list for later.', icon: Users, ...NEUTRAL },
  { key: 'reference', family: 'pipeline', label: 'Start reference checks', description: 'Kick off the referee request flow.', icon: ShieldCheck, ...NEUTRAL, soon: true },
  { key: 'webhook', family: 'pipeline', label: 'Call a webhook', description: 'POST the event to any HTTPS endpoint.', icon: Webhook, ...NEUTRAL },
]

export const ACTION_BY_KEY: Record<AutomationAction, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.key, a])) as any

export const FAMILY_LABEL: Record<ActionFamily, string> = {
  candidate: 'Candidate',
  team: 'Team',
  pipeline: 'Pipeline',
}

export interface TriggerDef {
  key: AutomationTrigger
  label: string
  /** Lower-case phrase used after "When". */
  phrase: string
  needsDays?: boolean
}

export const TRIGGERS: TriggerDef[] = [
  { key: 'enter', label: 'Candidate enters this stage', phrase: 'a candidate enters this stage' },
  { key: 'exit', label: 'Candidate leaves this stage', phrase: 'a candidate leaves this stage' },
  { key: 'idle', label: 'Candidate sits in this stage too long', phrase: 'a candidate sits here for {n} days', needsDays: true },
  { key: 'noreply', label: "Candidate hasn't replied", phrase: "a candidate hasn't replied for {n} days", needsDays: true },
  { key: 'replied', label: 'Candidate replies', phrase: 'a candidate replies' },
  { key: 'scheduled', label: 'Interview is scheduled', phrase: 'an interview is scheduled' },
  { key: 'completed', label: 'Interview is completed', phrase: 'an interview is completed' },
  { key: 'scorecard', label: 'A scorecard is submitted', phrase: 'a scorecard is submitted' },
  { key: 'allscorecards', label: 'Every scorecard is in', phrase: 'every scorecard is in' },
  { key: 'rejected', label: 'Candidate is rejected here', phrase: 'a candidate is rejected here' },
]

export const TRIGGER_BY_KEY: Record<AutomationTrigger, TriggerDef> = Object.fromEntries(TRIGGERS.map((t) => [t.key, t])) as any

export function triggerPhrase(trigger: AutomationTrigger, days?: number | null) {
  const def = TRIGGER_BY_KEY[trigger]
  if (!def) return trigger
  return def.phrase.replace('{n}', String(days ?? 3))
}

export function timingPhrase(timing: AutomationTiming, amount?: number | null, unit?: string | null, sendAt?: string | null) {
  if (timing === 'delay' && amount) {
    const u = unit === 'hours' ? (amount === 1 ? 'hour' : 'hours')
      : unit === 'business_days' ? (amount === 1 ? 'business day' : 'business days')
      : (amount === 1 ? 'day' : 'days')
    return `after ${amount} ${u}`
  }
  if (timing === 'at_time' && sendAt) {
    const [h, m] = sendAt.split(':')
    const hh = Number(h)
    const suffix = hh >= 12 ? 'pm' : 'am'
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    return `at ${h12}:${m ?? '00'} ${suffix}`
  }
  return 'immediately'
}

export const DELAY_UNITS: { key: DelayUnit; label: string }[] = [
  { key: 'hours', label: 'hours' },
  { key: 'days', label: 'days' },
  { key: 'business_days', label: 'business days' },
]

export function emptyEmailStep(): AutomationEmailStep {
  return { subject: '', body_html: '', attachments: [], delay_days: 0 }
}

export function defaultConfigFor(action: AutomationAction, fromEmail = ''): AutomationConfig {
  if (action === 'email') return { from: fromEmail, cc: [], bcc: [], template_id: null, emails: [emptyEmailStep()] }
  if (action === 'sequence') return { from: fromEmail, cc: [], bcc: [], template_id: null, emails: [emptyEmailStep(), { ...emptyEmailStep(), delay_days: 3 }] }
  if (action === 'notify') return { recipients: ['hiring_team'], channels: ['in_app'], message: '' }
  if (action === 'task') return { assignee: 'job_owner', due_offset_days: 1, message: '' }
  if (action === 'assign') return { assignee: null, role: 'interviewer' }
  if (action === 'move') return { target_stage_id: null }
  if (action === 'tag') return { tag_id: null }
  if (action === 'pool') return { pool_id: null }
  if (action === 'webhook') return { url: '', secret: '' }
  return {}
}

export function isEmailAction(action: AutomationAction) {
  return action === 'email' || action === 'sequence'
}

/** A one-line restatement for the footer: "{Trigger} → {action}, {timing}." */
export function restate(trigger: AutomationTrigger, days: number | null | undefined, action: AutomationAction, timing: AutomationTiming, amount?: number | null, unit?: string | null, sendAt?: string | null) {
  const t = triggerPhrase(trigger, days)
  const a = ACTION_BY_KEY[action]?.label.toLowerCase() ?? action
  const cap = t.charAt(0).toUpperCase() + t.slice(1)
  return `${cap} → ${a}, ${timingPhrase(timing, amount, unit, sendAt)}.`
}

/** The starter recipe: screening invite on entry + a nudge three days later. */
export function recipeScreeningInvite(fromEmail: string) {
  return {
    name: 'Screening invite + nudge',
    action: 'sequence' as AutomationAction,
    trigger: 'enter' as AutomationTrigger,
    timing: 'immediate' as AutomationTiming,
    config: {
      from: fromEmail, cc: [], bcc: [], template_id: null,
      emails: [
        {
          subject: 'Next step for {{job.title}} — pick a time to chat',
          body_html: '<p>Hi {{candidate.first_name}},</p><p>Thanks for your interest in the {{job.title}} role. I\'d love to set up a short screening call — grab any slot that works for you here: {{scheduling.link}}</p><p>Talk soon,<br/>{{sender.first_name}}</p>',
          attachments: [], delay_days: 0,
        },
        {
          subject: 'Re: Next step for {{job.title}}',
          body_html: '<p>Hi {{candidate.first_name}},</p><p>Just a quick nudge in case this slipped through — the link to book a screening call is still open: {{scheduling.link}}</p><p>{{sender.first_name}}</p>',
          attachments: [], delay_days: 3,
        },
      ],
    } as AutomationConfig,
  }
}

// Variables surfaced in the composer's popover (grouped, searchable)
export interface VariableDef { key: string; label: string; group: string }
export const COMPOSER_VARIABLES: VariableDef[] = [
  { key: 'candidate.first_name', label: 'First name', group: 'Candidate' },
  { key: 'candidate.full_name', label: 'Full name', group: 'Candidate' },
  { key: 'candidate.email', label: 'Email', group: 'Candidate' },
  { key: 'job.title', label: 'Title', group: 'Job' },
  { key: 'job.department', label: 'Department', group: 'Job' },
  { key: 'job.location', label: 'Location', group: 'Job' },
  { key: 'job.salary_range', label: 'Salary range', group: 'Job' },
  { key: 'client.name', label: 'Client name', group: 'Job' },
  { key: 'stage.name', label: 'Stage name', group: 'Stage & people' },
  { key: 'recruiter.first_name', label: 'Recruiter first name', group: 'Stage & people' },
  { key: 'sender.name', label: 'Sender full name', group: 'Stage & people' },
  { key: 'interview.datetime', label: 'Interview date & time', group: 'Stage & people' },
  { key: 'scheduling.link', label: 'Scheduling link', group: 'Stage & people' },
]

export const ATTACHMENT_TOTAL_LIMIT = 25 * 1024 * 1024

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
