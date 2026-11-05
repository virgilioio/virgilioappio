import type { DimensionId } from './types'

export interface DimensionDef {
  id: DimensionId
  label: string
  kind: 'time' | 'categorical' | 'none'
  group: 'recruiting' | 'shared' | 'market'
  /** Market: one person can count in several values (skills, past companies) */
  multi?: boolean
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

  mkt_country:        { id: 'mkt_country',        label: 'Country',            kind: 'categorical', group: 'market' },
  mkt_city:           { id: 'mkt_city',           label: 'City',               kind: 'categorical', group: 'market' },
  mkt_role_family:    { id: 'mkt_role_family',    label: 'Role family',        kind: 'categorical', group: 'market' },
  mkt_title:          { id: 'mkt_title',          label: 'Title',              kind: 'categorical', group: 'market' },
  mkt_specialization: { id: 'mkt_specialization', label: 'Specialization',     kind: 'categorical', group: 'market' },
  mkt_seniority:      { id: 'mkt_seniority',      label: 'Seniority',          kind: 'categorical', group: 'market' },
  mkt_company:        { id: 'mkt_company',        label: 'Current company',    kind: 'categorical', group: 'market' },
  mkt_past_company:   { id: 'mkt_past_company',   label: 'Past company',       kind: 'categorical', group: 'market', multi: true },
  mkt_salary_band:    { id: 'mkt_salary_band',    label: 'Salary band',        kind: 'categorical', group: 'market' },
  mkt_experience:     { id: 'mkt_experience',     label: 'Experience',         kind: 'categorical', group: 'market' },
  mkt_skills:         { id: 'mkt_skills',         label: 'Skill',              kind: 'categorical', group: 'market', multi: true },
  mkt_source:         { id: 'mkt_source',         label: 'Source',             kind: 'categorical', group: 'market' },
  // By job and client (2026-11-05). Job and Client count a person once per job.
  mkt_client:         { id: 'mkt_client',         label: 'Client',             kind: 'categorical', group: 'market', multi: true },
  mkt_job:            { id: 'mkt_job',            label: 'Job',                kind: 'categorical', group: 'market', multi: true },
  mkt_job_status:     { id: 'mkt_job_status',     label: 'Job status',         kind: 'categorical', group: 'market', multi: true },
  mkt_job_state:      { id: 'mkt_job_state',      label: 'Status in the job',  kind: 'categorical', group: 'market', multi: true },
  mkt_stage:          { id: 'mkt_stage',          label: 'Stage',              kind: 'categorical', group: 'market', multi: true },
  mkt_came_in:        { id: 'mkt_came_in',        label: 'How they came in',   kind: 'categorical', group: 'market', multi: true },
  mkt_rejection:      { id: 'mkt_rejection',      label: 'Rejection reason',   kind: 'categorical', group: 'market', multi: true },
  mkt_added:          { id: 'mkt_added',          label: 'Added to the job',   kind: 'categorical', group: 'market', multi: true },
  mkt_job_month:      { id: 'mkt_job_month',      label: 'Added to a job over time', kind: 'time', group: 'market', multi: true },
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

// Intelligence: what market metrics split by ('time' = when people joined Gio).
export const MARKET_DIMENSIONS: DimensionDef[] = [
  { ...DIMENSIONS.time, label: 'Added to Gio over time' },
  DIMENSIONS.mkt_job_month,
  DIMENSIONS.mkt_client,
  DIMENSIONS.mkt_job,
  DIMENSIONS.mkt_stage,
  DIMENSIONS.mkt_job_state,
  DIMENSIONS.mkt_came_in,
  DIMENSIONS.mkt_rejection,
  DIMENSIONS.mkt_job_status,
  DIMENSIONS.mkt_country,
  DIMENSIONS.mkt_city,
  DIMENSIONS.mkt_role_family,
  DIMENSIONS.mkt_title,
  DIMENSIONS.mkt_specialization,
  DIMENSIONS.mkt_seniority,
  DIMENSIONS.mkt_experience,
  DIMENSIONS.mkt_salary_band,
  DIMENSIONS.mkt_company,
  DIMENSIONS.mkt_past_company,
  DIMENSIONS.mkt_skills,
  DIMENSIONS.mkt_source,
]
