import {
  FileText,
  Users,
  UserCheck,
  Clock,
  Video,
  CalendarClock,
  Send,
  CheckCircle,
  XCircle,
  DollarSign,
  Trophy,
  Briefcase,
  Target,
  Wallet,
  Banknote,
  Sparkles,
  Repeat,
  Hourglass,
  AlertTriangle,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import type { DeltaGood, Format, MetricGroup, MetricId, Tone } from './types'

export interface MetricDef {
  id: MetricId
  label: string
  tone: Tone
  icon: LucideIcon
  format: Format
  deltaGood: DeltaGood
  group: MetricGroup
}

export const METRICS: Record<MetricId, MetricDef> = {
  // ATS / Recruiting
  applications:         { id: 'applications',         label: 'Applications',          tone: 'green',   icon: FileText,      format: 'count', deltaGood: 'up',   group: 'recruiting' },
  active_candidates:    { id: 'active_candidates',    label: 'Active candidates',     tone: 'green',   icon: Users,         format: 'count', deltaGood: 'up',   group: 'recruiting' },
  hires:                { id: 'hires',                label: 'Hires',                 tone: 'green',   icon: UserCheck,     format: 'count', deltaGood: 'up',   group: 'recruiting' },
  time_to_hire:         { id: 'time_to_hire',         label: 'Avg time to hire',      tone: 'blue',    icon: Clock,         format: 'days',  deltaGood: 'down', group: 'recruiting' },
  interviews:           { id: 'interviews',           label: 'Interviews completed',  tone: 'blue',    icon: Video,         format: 'count', deltaGood: 'up',   group: 'recruiting' },
  interviews_scheduled: { id: 'interviews_scheduled', label: 'Interviews scheduled',  tone: 'blue',    icon: CalendarClock, format: 'count', deltaGood: 'up',   group: 'recruiting' },
  offers_sent:          { id: 'offers_sent',          label: 'Offers sent',           tone: 'pink',    icon: Send,          format: 'count', deltaGood: 'up',   group: 'recruiting' },
  offer_acceptance:     { id: 'offer_acceptance',     label: 'Offer acceptance',      tone: 'purple',  icon: CheckCircle,   format: 'pct',   deltaGood: 'up',   group: 'recruiting' },
  rejections:           { id: 'rejections',           label: 'Rejections',            tone: 'neutral', icon: XCircle,       format: 'count', deltaGood: 'down', group: 'recruiting' },
  interviews_per_hire:  { id: 'interviews_per_hire',  label: 'Interviews per hire',   tone: 'blue',    icon: Repeat,        format: 'ratio', deltaGood: 'down', group: 'recruiting' },

  avg_days_in_stage:    { id: 'avg_days_in_stage',    label: 'Avg days in stage',     tone: 'amber',   icon: Hourglass,     format: 'days',  deltaGood: 'down', group: 'hygiene' },
  stuck_candidates:     { id: 'stuck_candidates',     label: 'Stuck candidates',      tone: 'pink',    icon: AlertTriangle, format: 'count', deltaGood: 'down', group: 'hygiene' },
  days_in_pipeline:     { id: 'days_in_pipeline',     label: 'Avg days in pipeline',  tone: 'amber',   icon: Timer,         format: 'days',  deltaGood: 'down', group: 'hygiene' },
}

export const METRIC_LIST = Object.values(METRICS)
export const RECRUITING_METRICS = METRIC_LIST.filter(m => m.group === 'recruiting')
export const HYGIENE_METRICS = METRIC_LIST.filter(m => m.group === 'hygiene')
