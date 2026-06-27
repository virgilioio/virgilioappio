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

  // CRM / Revenue
  open_pipeline:    { id: 'open_pipeline',    label: 'Open pipeline',     tone: 'purple', icon: DollarSign,   format: 'money', deltaGood: 'up',   group: 'crm' },
  revenue_won:      { id: 'revenue_won',      label: 'Revenue won',       tone: 'green',  icon: Trophy,       format: 'money', deltaGood: 'up',   group: 'crm' },
  open_deals:       { id: 'open_deals',       label: 'Open deals',        tone: 'amber',  icon: Briefcase,    format: 'count', deltaGood: 'up',   group: 'crm' },
  deals_won:        { id: 'deals_won',        label: 'Deals won',         tone: 'green',  icon: CheckCircle,  format: 'count', deltaGood: 'up',   group: 'crm' },
  win_rate:         { id: 'win_rate',         label: 'Win rate',          tone: 'purple', icon: Target,       format: 'pct',   deltaGood: 'up',   group: 'crm' },
  avg_sales_cycle:  { id: 'avg_sales_cycle',  label: 'Avg sales cycle',   tone: 'blue',   icon: Clock,        format: 'days',  deltaGood: 'down', group: 'crm' },
  avg_deal_size:    { id: 'avg_deal_size',    label: 'Avg deal size',     tone: 'blue',   icon: Wallet,       format: 'money', deltaGood: 'up',   group: 'crm' },
  collected:        { id: 'collected',        label: 'Collected',         tone: 'green',  icon: Banknote,     format: 'money', deltaGood: 'up',   group: 'crm' },
  outstanding:      { id: 'outstanding',      label: 'Outstanding',       tone: 'amber',  icon: Wallet,       format: 'money', deltaGood: 'down', group: 'crm' },
  new_deals:        { id: 'new_deals',        label: 'New deals',         tone: 'pink',   icon: Sparkles,     format: 'count', deltaGood: 'up',   group: 'crm' },
}

export const METRIC_LIST = Object.values(METRICS)
export const RECRUITING_METRICS = METRIC_LIST.filter(m => m.group === 'recruiting')
export const CRM_METRICS = METRIC_LIST.filter(m => m.group === 'crm')
