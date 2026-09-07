/**
 * Job priority — single source of truth for the enum, its labels and colors.
 * The DB column is `jobs.priority` (enum job_priority), NOT NULL default 'standard'.
 */

export const JOB_PRIORITIES = [
  { id: 'critical', label: 'Critical', dot: '#FA5252', tint: '#FDECEC', ink: '#B4232C' },
  { id: 'high', label: 'High', dot: '#E0891A', tint: '#FBF0DF', ink: '#8A5306' },
  { id: 'standard', label: 'Standard', dot: '#6F3FF5', tint: '#EFE9FE', ink: '#4B21C0' },
  { id: 'low', label: 'Low', dot: '#8B8F9E', tint: '#F1F0EC', ink: '#5A6072' },
] as const

export type JobPriority = (typeof JOB_PRIORITIES)[number]['id']

export const DEFAULT_JOB_PRIORITY: JobPriority = 'standard'

export function jobPriorityMeta(value?: JobPriority | string | null) {
  return (
    JOB_PRIORITIES.find((p) => p.id === value) ??
    JOB_PRIORITIES.find((p) => p.id === DEFAULT_JOB_PRIORITY)!
  )
}

/** Ascending rank — 0 = most urgent. Never sort priorities alphabetically. */
export function jobPriorityRank(value?: JobPriority | string | null): number {
  const i = JOB_PRIORITIES.findIndex((p) => p.id === value)
  return i === -1 ? JOB_PRIORITIES.findIndex((p) => p.id === DEFAULT_JOB_PRIORITY) : i
}

/** Only these two get visual weight in dense lists. */
export function isLoudJobPriority(value?: JobPriority | string | null): boolean {
  return value === 'critical' || value === 'high'
}
