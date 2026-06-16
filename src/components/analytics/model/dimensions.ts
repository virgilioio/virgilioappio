import type { DimensionId } from './types'

export interface DimensionDef {
  id: DimensionId
  label: string
  kind: 'time' | 'categorical' | 'none'
  // funnel-shape: stage is a decreasing funnel
  funnel?: boolean
}

export const DIMENSIONS: Record<DimensionId, DimensionDef> = {
  none:        { id: 'none',       label: 'No split',      kind: 'none' },
  time:        { id: 'time',       label: 'Over time',     kind: 'time' },
  stage:       { id: 'stage',      label: 'Stage',         kind: 'categorical', funnel: true },
  job:         { id: 'job',        label: 'Job',           kind: 'categorical' },
  recruiter:   { id: 'recruiter',  label: 'Recruiter',     kind: 'categorical' },
  source:      { id: 'source',     label: 'Source',        kind: 'categorical' },
  seniority:   { id: 'seniority',  label: 'Seniority',     kind: 'categorical' },
  skills:      { id: 'skills',     label: 'Top skills',    kind: 'categorical' },
  experience:  { id: 'experience', label: 'Experience',    kind: 'categorical' },
  geography:   { id: 'geography',  label: 'Country',       kind: 'categorical' },
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
]
