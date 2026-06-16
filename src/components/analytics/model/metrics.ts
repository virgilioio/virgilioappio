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
  type LucideIcon,
} from 'lucide-react'
import type { DeltaGood, Format, MetricId, Tone } from './types'

export interface MetricDef {
  id: MetricId
  label: string
  tone: Tone
  icon: LucideIcon
  format: Format
  deltaGood: DeltaGood
}

export const METRICS: Record<MetricId, MetricDef> = {
  applications:         { id: 'applications',         label: 'Applications',          tone: 'green',   icon: FileText,      format: 'count', deltaGood: 'up' },
  active_candidates:    { id: 'active_candidates',    label: 'Active candidates',     tone: 'green',   icon: Users,         format: 'count', deltaGood: 'up' },
  hires:                { id: 'hires',                label: 'Hires',                 tone: 'green',   icon: UserCheck,     format: 'count', deltaGood: 'up' },
  time_to_hire:         { id: 'time_to_hire',         label: 'Avg time to hire',      tone: 'blue',    icon: Clock,         format: 'days',  deltaGood: 'down' },
  interviews:           { id: 'interviews',           label: 'Interviews completed',  tone: 'blue',    icon: Video,         format: 'count', deltaGood: 'up' },
  interviews_scheduled: { id: 'interviews_scheduled', label: 'Interviews scheduled',  tone: 'blue',    icon: CalendarClock, format: 'count', deltaGood: 'up' },
  offers_sent:          { id: 'offers_sent',          label: 'Offers sent',           tone: 'pink',    icon: Send,          format: 'count', deltaGood: 'up' },
  offer_acceptance:     { id: 'offer_acceptance',     label: 'Offer acceptance',      tone: 'purple',  icon: CheckCircle,   format: 'pct',   deltaGood: 'up' },
  rejections:           { id: 'rejections',           label: 'Rejections',            tone: 'neutral', icon: XCircle,       format: 'count', deltaGood: 'down' },
}

export const METRIC_LIST = Object.values(METRICS)
