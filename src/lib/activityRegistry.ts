/**
 * Activity feed event registry.
 * Single source of truth for: which category an event belongs to,
 * which glyph it uses, and which tone colours that glyph.
 *
 * Never drop an unmapped event — unknown types fall back to
 * `circle-dot` / neutral under "Other events".
 */
import {
  ArrowRight,
  ClipboardCheck,
  Send,
  Inbox,
  Paperclip,
  UserPlus,
  FileText,
  Briefcase,
  Pencil,
  CircleDot,
  StickyNote,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FilePen,
  FileCheck,
  Zap,
  ZapOff,
  type LucideIcon,
} from 'lucide-react'

export type ActivityCategory = 'stage' | 'scorecards' | 'emails' | 'automations' | 'files' | 'other'

export type ActivityTone =
  | 'purple'
  | 'green'
  | 'blue'
  | 'yellow'
  | 'pink'
  | 'red'
  | 'neutral'

export interface ActivityMeta {
  category: ActivityCategory
  icon: LucideIcon
  tone: ActivityTone
}

export const ACTIVITY_TONES: Record<ActivityTone, { bg: string; fg: string }> = {
  purple: { bg: '#EDE4FF', fg: '#6F3FF5' },
  green: { bg: '#D1FAE5', fg: '#12B886' },
  blue: { bg: '#DBEAFE', fg: '#2563EB' },
  yellow: { bg: '#FEF3C7', fg: '#B45309' },
  pink: { bg: '#FCE7F3', fg: '#BE185D' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
  neutral: { bg: '#F1F0EC', fg: '#5A6072' },
}

/** Every event the machine produced by itself. `zap`/`zap-off` are reserved for these. */
export const AUTOMATION_ACTIVITY_TYPES = [
  'candidate_email_automated',
  'automation_triggered',
  'automation_skipped',
  'sequence_enrolled',
  'sequence_completed',
] as const

const AUTOMATION_TYPE_SET = new Set<string>(AUTOMATION_ACTIVITY_TYPES)

export const ACTIVITY_TYPES: Record<string, ActivityMeta> = {
  // Stage moves
  candidate_stage_changed: { category: 'stage', icon: ArrowRight, tone: 'purple' },

  // Scorecards
  scorecard_submitted: { category: 'scorecards', icon: ClipboardCheck, tone: 'green' },

  // Emails (written by a person)
  candidate_email_sent: { category: 'emails', icon: Send, tone: 'neutral' },
  candidate_email_received: { category: 'emails', icon: Inbox, tone: 'blue' },

  // Automations — including automated emails
  candidate_email_automated: { category: 'automations', icon: Zap, tone: 'yellow' },
  automation_triggered: { category: 'automations', icon: Zap, tone: 'yellow' },
  automation_skipped: { category: 'automations', icon: ZapOff, tone: 'yellow' },
  sequence_enrolled: { category: 'automations', icon: Zap, tone: 'yellow' },
  sequence_completed: { category: 'automations', icon: Zap, tone: 'yellow' },

  // Files
  candidate_attachment_uploaded: { category: 'files', icon: Paperclip, tone: 'neutral' },

  // Other events
  candidate_created: { category: 'other', icon: UserPlus, tone: 'pink' },
  candidate_added: { category: 'other', icon: UserPlus, tone: 'pink' },
  candidate_applied: { category: 'other', icon: FileText, tone: 'blue' },
  candidate_assigned_to_job: { category: 'other', icon: Briefcase, tone: 'purple' },
  candidate_updated: { category: 'other', icon: Pencil, tone: 'neutral' },
  candidate_profile_updated: { category: 'other', icon: Pencil, tone: 'neutral' },
  candidate_status_changed: { category: 'other', icon: CircleDot, tone: 'neutral' },
  candidate_note_added: { category: 'other', icon: StickyNote, tone: 'yellow' },
  interview_scheduled: { category: 'other', icon: CalendarCheck, tone: 'blue' },
  interview_rescheduled: { category: 'other', icon: CalendarClock, tone: 'yellow' },
  interview_cancelled: { category: 'other', icon: CalendarX, tone: 'red' },
  offer_created: { category: 'other', icon: FileText, tone: 'purple' },
  offer_updated: { category: 'other', icon: FilePen, tone: 'purple' },
  offer_sent: { category: 'other', icon: Send, tone: 'green' },
  offer_document_generated: { category: 'other', icon: FileCheck, tone: 'neutral' },
}

export const ACTIVITY_FALLBACK: ActivityMeta = {
  category: 'other',
  icon: CircleDot,
  tone: 'neutral',
}

export function activityMeta(type: string): ActivityMeta {
  return ACTIVITY_TYPES[type] || ACTIVITY_FALLBACK
}

/**
 * The machine did this, not a person. Use this everywhere instead of
 * comparing activity type strings inline.
 */
export function isAutomated(event: {
  activity_type?: string | null
  automation?: unknown
  metadata?: Record<string, any> | null
}): boolean {
  if (event?.automation) return true
  if (event?.metadata?.automation) return true
  return AUTOMATION_TYPE_SET.has(event?.activity_type || '')
}

export const ACTIVITY_CATEGORIES: { id: ActivityCategory; label: string }[] = [
  { id: 'stage', label: 'Stage moves' },
  { id: 'scorecards', label: 'Scorecards' },
  { id: 'emails', label: 'Emails' },
  { id: 'automations', label: 'Automations' },
  { id: 'files', label: 'Files' },
  { id: 'other', label: 'Other events' },
]
