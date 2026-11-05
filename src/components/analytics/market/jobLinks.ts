import type { DimensionId } from '../model/types'

/**
 * Intelligence by job and client (2026-11-05): where each person stands in the jobs you
 * can see, from market_job_links() (one row per person per job). Job filters always
 * describe the same job: "Client: Acme" + "In the job as: Hired" means hired in an Acme
 * job, not hired somewhere and in an Acme job. Inside those filters the job values
 * (stage, status, how they came in…) are read from the matching jobs only.
 * Pure functions, so the widgets, the filter bar and the CSV agree.
 */
export interface JobLink {
  candidate_id: string
  job_id: string
  job_title: string
  job_status: string | null
  client_id: string | null
  client_name: string | null
  /** active · offer · hired · rejected */
  status: string
  stage_name: string | null
  stage_type: string | null
  applied: boolean
  added_at: string
  rejection_reason: string | null
  /** The job's pay range per month in the workspace's base currency (budget, else salary range). */
  budget_min_month_base?: number | null
  budget_max_month_base?: number | null
}

export const JOB_DIMENSIONS: ReadonlySet<DimensionId> = new Set<DimensionId>([
  'mkt_client', 'mkt_job', 'mkt_job_status', 'mkt_job_state', 'mkt_stage',
  'mkt_came_in', 'mkt_rejection', 'mkt_added', 'mkt_job_month',
])
export const isJobDimension = (d: DimensionId) => JOB_DIMENSIONS.has(d)

export const JOB_STATUS_LABEL: Record<string, string> = { open: 'Open', draft: 'Draft', closed: 'Closed', archived: 'Archived' }
export const JOB_STATUS_ORDER = ['Open', 'Draft', 'Closed', 'Archived']
export const JOB_STATE_LABEL: Record<string, string> = { active: 'In process', offer: 'Offer', hired: 'Hired', rejected: 'Rejected' }
export const JOB_STATE_ORDER = ['In process', 'Offer', 'Hired', 'Rejected']
export const CAME_IN_ORDER = ['Applied', 'Added by the team']
export const NO_CLIENT = 'No client'
export const NO_REASON = 'No reason given'

export const ADDED_PERIODS = ['This month', 'This quarter', 'This year', 'Last 12 months'] as const
export type AddedPeriod = (typeof ADDED_PERIODS)[number]

/** When a period starts, in the browser's own days. */
export function periodStart(p: string, now: Date): Date | null {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (p === 'This month') return new Date(y, m, 1)
  if (p === 'This quarter') return new Date(y, m - (m % 3), 1)
  if (p === 'This year') return new Date(y, 0, 1)
  if (p === 'Last 12 months') return new Date(y - 1, m, now.getDate())
  return null
}

const STAGE_TYPE_RANK = [
  'application', 'application_review', 'screening', 'interview', 'assessment',
  'reference', 'final', 'final_review', 'offer', 'onboarding', 'hired',
]
const rankOf = (t: string | null) => {
  const i = t ? STAGE_TYPE_RANK.indexOf(t) : -1
  return i === -1 ? 5.5 : i
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export interface JobOption {
  id: string
  label: string
  title: string
  clientId: string | null
  client: string
  status: string
  people: number
  budgetMin: number | null
  budgetMax: number | null
}

export interface JobIndex {
  byPerson: Map<string, JobLink[]>
  jobs: JobOption[]
  jobLabel: Map<string, string>
  clients: { id: string | null; label: string; people: number }[]
  stageOrder: string[]
}

export const EMPTY_JOB_INDEX: JobIndex = { byPerson: new Map(), jobs: [], jobLabel: new Map(), clients: [], stageOrder: [] }

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export const clientOf = (l: Pick<JobLink, 'client_name'>) => l.client_name?.trim() || NO_CLIENT

/** People per job and client, each job named once (a repeated title takes its client). */
export function buildJobIndex(links: JobLink[]): JobIndex {
  const byPerson = new Map<string, JobLink[]>()
  const jobsById = new Map<string, { title: string; clientId: string | null; client: string; status: string; people: Set<string>; budgetMin: number | null; budgetMax: number | null }>()
  const clientPeople = new Map<string, { id: string | null; people: Set<string> }>()
  const stageRank = new Map<string, number>()
  for (const l of links) {
    const list = byPerson.get(l.candidate_id) ?? []
    list.push(l)
    byPerson.set(l.candidate_id, list)
    const job = jobsById.get(l.job_id) ?? {
      title: l.job_title?.trim() || 'Untitled job',
      clientId: l.client_id,
      client: clientOf(l),
      status: JOB_STATUS_LABEL[l.job_status ?? ''] ?? (l.job_status || 'Open'),
      people: new Set<string>(),
      budgetMin: num(l.budget_min_month_base),
      budgetMax: num(l.budget_max_month_base),
    }
    job.people.add(l.candidate_id)
    jobsById.set(l.job_id, job)
    const c = clientPeople.get(clientOf(l)) ?? { id: l.client_id, people: new Set<string>() }
    c.people.add(l.candidate_id)
    clientPeople.set(clientOf(l), c)
    if (l.stage_name) stageRank.set(l.stage_name, Math.min(stageRank.get(l.stage_name) ?? 99, rankOf(l.stage_type)))
  }

  const titleCount = new Map<string, number>()
  for (const j of jobsById.values()) titleCount.set(j.title, (titleCount.get(j.title) ?? 0) + 1)
  const labelCount = new Map<string, number>()
  const jobLabel = new Map<string, string>()
  const jobs: JobOption[] = []
  for (const [id, j] of jobsById) {
    let label = (titleCount.get(j.title) ?? 0) > 1 ? `${j.title} · ${j.client}` : j.title
    const seen = labelCount.get(label) ?? 0
    labelCount.set(label, seen + 1)
    if (seen > 0) label = `${label} (${seen + 1})`
    jobLabel.set(id, label)
    jobs.push({ id, label, title: j.title, clientId: j.clientId, client: j.client, status: j.status, people: j.people.size, budgetMin: j.budgetMin, budgetMax: j.budgetMax })
  }
  jobs.sort((a, b) => a.client.localeCompare(b.client) || a.title.localeCompare(b.title))

  const clients = [...clientPeople.entries()]
    .map(([label, c]) => ({ id: c.id, label, people: c.people.size }))
    .sort((a, b) => (a.label === NO_CLIENT ? 1 : b.label === NO_CLIENT ? -1 : a.label.localeCompare(b.label)))

  const stageOrder = [...stageRank.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([name]) => name)
  return { byPerson, jobs, jobLabel, clients, stageOrder }
}

/** A job link's values for one dimension (a period can hold several: this month is also this year). */
export function linkValues(l: JobLink, dim: DimensionId, idx: JobIndex, now: Date): string[] {
  switch (dim) {
    case 'mkt_client': return [clientOf(l)]
    case 'mkt_job': return [idx.jobLabel.get(l.job_id) ?? l.job_title]
    case 'mkt_job_status': return [JOB_STATUS_LABEL[l.job_status ?? ''] ?? (l.job_status || 'Open')]
    case 'mkt_job_state': return [JOB_STATE_LABEL[l.status] ?? l.status]
    case 'mkt_stage': return l.stage_name ? [l.stage_name] : []
    case 'mkt_came_in': return [l.applied ? 'Applied' : 'Added by the team']
    case 'mkt_rejection': return l.status === 'rejected' ? [l.rejection_reason?.trim() || NO_REASON] : []
    case 'mkt_added': {
      const at = new Date(l.added_at)
      return ADDED_PERIODS.filter(p => { const s = periodStart(p, now); return !!s && at >= s && at <= now })
    }
    case 'mkt_job_month': return [monthLabel(l.added_at)]
    default: return []
  }
}

export type JobScope = [DimensionId, Set<string>][]

export function linkMatches(l: JobLink, scope: JobScope, idx: JobIndex, now: Date): boolean {
  return scope.every(([dim, wanted]) => linkValues(l, dim, idx, now).some(v => wanted.has(v)))
}

/** A person's jobs that meet every job filter (all their jobs when there are none). */
export function linksInScope(personId: string, scope: JobScope, idx: JobIndex, now: Date): JobLink[] {
  const all = idx.byPerson.get(personId) ?? []
  return scope.length === 0 ? all : all.filter(l => linkMatches(l, scope, idx, now))
}

/** Job and Client count a person once per job; the rest once per person. */
export const COUNTS_PER_JOB: ReadonlySet<DimensionId> = new Set<DimensionId>(['mkt_job', 'mkt_client'])

export function jobDimensionValues(personId: string, dim: DimensionId, scope: JobScope, idx: JobIndex, now: Date): string[] {
  const vals = linksInScope(personId, scope, idx, now).flatMap(l => linkValues(l, dim, idx, now))
  return COUNTS_PER_JOB.has(dim) ? vals : [...new Set(vals)]
}

export function jobOrderFor(dim: DimensionId, idx: JobIndex): string[] | null {
  switch (dim) {
    case 'mkt_job_status': return JOB_STATUS_ORDER
    case 'mkt_job_state': return JOB_STATE_ORDER
    case 'mkt_came_in': return CAME_IN_ORDER
    case 'mkt_added': return [...ADDED_PERIODS]
    case 'mkt_stage': return idx.stageOrder
    default: return null
  }
}

/** The one job a page is narrowed to (one Job value picked), for its pay range. */
export function singleJob(scope: JobScope, idx: JobIndex): JobOption | null {
  const picked = scope.find(([d]) => d === 'mkt_job')?.[1]
  if (!picked || picked.size !== 1) return null
  const label = [...picked][0]
  return idx.jobs.find(j => j.label === label) ?? null
}
