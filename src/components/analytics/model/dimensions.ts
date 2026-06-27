import type { DimensionId } from './types'

export interface DimensionDef {
  id: DimensionId
  label: string
  kind: 'time' | 'categorical' | 'none'
  group: 'recruiting' | 'crm' | 'shared'
  // funnel-shape: stage is a decreasing funnel
  funnel?: boolean
}

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  none:        { id: 'none',        label: 'No split',      kind: 'none',        group: 'shared' },
  time:        { id: 'time',        label: 'Over time',     kind: 'time',        group: 'shared' },
  stage:       { id: 'stage',       label: 'Stage',         kind: 'categorical', group: 'recruiting', funnel: true },
  job:         { id: 'job',         label: 'Job',           kind: 'categorical', group: 'recruiting' },
  recruiter:   { id: 'recruiter',   label: 'Recruiter',     kind: 'categorical', group: 'recruiting' },
  source:      { id: 'source',      label: 'Source',        kind: 'categorical', group: 'recruiting' },
  seniority:   { id: 'seniority',   label: 'Seniority',     kind: 'categorical', group: 'recruiting' },
  skills:      { id: 'skills',      label: 'Top skills',    kind: 'categorical', group: 'recruiting' },
  experience:  { id: 'experience',  label: 'Experience',    kind: 'categorical', group: 'recruiting' },
  geography:   { id: 'geography',   label: 'Country',       kind: 'categorical', group: 'recruiting' },
  // CRM
  deal_stage:  { id: 'deal_stage',  label: 'Deal stage',    kind: 'categorical', group: 'crm', funnel: true },
  deal_owner:  { id: 'deal_owner',  label: 'Deal owner',    kind: 'categorical', group: 'crm' },
  company:     { id: 'company',     label: 'Company',       kind: 'categorical', group: 'crm' },
  deal_source: { id: 'deal_source', label: 'Deal source',   kind: 'categorical', group: 'crm' },
}

// Dimensions a user can choose in the config popover (NOT 'none', that is the default no-split).
export const SPLITTABLE_DIMENSIONS: DimensionDef[] = [
  DIMENSIONS.time,
  DIMENSIONS.stage,
  DIMENSIONS.job,
  DIMENSIONS.recruiter,
  DIMENSIONS.source,
  DIMENSIONS.seniority,
  DIMENSIONS.skills,
  DIMENSIONS.experience,
  DIMENSIONS.geography,
  DIMENSIONS.deal_stage,
  DIMENSIONS.deal_owner,
  DIMENSIONS.company,
  DIMENSIONS.deal_source,
]
