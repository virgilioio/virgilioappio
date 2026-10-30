/**
 * Candidate profile arrow-navigation order (2026-10-30).
 *
 * A job's candidates live in five lists: Application review, Recruiting
 * process, Job offers, Hired and Rejected. The profile's ‹ › arrows walk the
 * list the candidate was opened from, in the order it showed, and never cross
 * into another list: the first has no Previous, the last no Next.
 *
 * Opening a profile from a list freezes that list's order in sessionStorage,
 * so a rejection mid-browse doesn't reshuffle where Next lands. With no saved
 * list (a link from the bell, Slack or a refresh), the arrows walk the
 * candidate's own list, rebuilt with the same rule the job page uses.
 */

export type PipelineSection = 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'

const KEY = 'gio:candidateNavOrder'

interface StoredNavOrder {
  jobId: string
  section: PipelineSection
  order: string[]
  savedAt: number
}

export interface SavedNavOrder {
  section: PipelineSection
  order: string[]
}

export function saveCandidateNavOrder(jobId: string, section: PipelineSection, order: string[]) {
  if (!jobId || !order || order.length === 0) return
  try {
    const payload: StoredNavOrder = { jobId, section, order, savedAt: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable: the profile rebuilds the candidate's own list
  }
}

export function readCandidateNavOrder(jobId: string): SavedNavOrder | null {
  if (!jobId) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredNavOrder
    if (!parsed || parsed.jobId !== jobId || !Array.isArray(parsed.order) || !parsed.section) return null
    return {
      section: parsed.section,
      order: parsed.order.filter((id) => typeof id === 'string' && id.length > 0),
    }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ *
 * Which list a candidate is in. The job page builds its lists with
 * these exact rules, so the profile's fallback can't drift from them.
 * ------------------------------------------------------------------ */

export interface SectionAssoc {
  status?: string | null
  current_stage_id?: string | null
}

/** stage type of a job hiring stage id, e.g. 'application_review', 'offer' */
export type StageTypeOf = (jhsId: string) => string | undefined

export function inPipelineSection(a: SectionAssoc, section: PipelineSection, stageType: StageTypeOf): boolean {
  const type = a.current_stage_id ? stageType(a.current_stage_id) : undefined
  switch (section) {
    case 'rejected':
      return a.status === 'rejected'
    case 'hired':
      return a.status === 'hired'
    case 'offers':
      return a.status !== 'rejected' && (a.status === 'offer' || type === 'offer')
    case 'application':
      return a.status === 'active' && !!a.current_stage_id && type === 'application_review'
    case 'recruiting':
      return (
        a.status !== 'rejected' &&
        a.status !== 'hired' &&
        a.status !== 'offer' &&
        !!a.current_stage_id &&
        type !== 'offer' &&
        type !== 'application_review'
      )
  }
}

/** The one list a candidate belongs to (rejected and hired first, as their tabs show them). */
export function pipelineSectionOf(a: SectionAssoc, stageType: StageTypeOf): PipelineSection | null {
  const order: PipelineSection[] = ['rejected', 'hired', 'offers', 'application', 'recruiting']
  return order.find((s) => inPipelineSection(a, s, stageType)) ?? null
}

export interface NavAssoc extends SectionAssoc {
  candidate_id: string
  created_at?: string | null
  ai_fit_score?: number | null
  rejected_at?: string | null
  updated_at?: string | null
  pipeline_position?: number | null
  entered_stage_at?: string | null
}

const time = (v?: string | null) => (v ? new Date(v).getTime() || 0 : 0)

/**
 * A list rebuilt the way its tab shows it by default. Every tab starts from the
 * job's applications in their saved order (`pipeline_position`, empty last, then
 * newest added); Application review then sorts by Gio Fit score, Rejected by
 * newest rejection, and Recruiting process goes stage by stage, ordered within a
 * stage as the board orders it (`withinStage`; oldest in the stage when not given).
 */
export function sectionOrder<T extends NavAssoc>(
  assocs: T[],
  section: PipelineSection,
  stageType: StageTypeOf,
  stagePosition: (jhsId: string) => number,
  withinStage?: (a: T, b: T) => number,
): string[] {
  const place = (a: T) => a.pipeline_position ?? Number.MAX_SAFE_INTEGER
  const rows = assocs
    .filter((a) => inPipelineSection(a, section, stageType))
    .sort((a, b) => place(a) - place(b) || time(b.created_at) - time(a.created_at))
  if (section === 'application') rows.sort((a, b) => (b.ai_fit_score ?? -1) - (a.ai_fit_score ?? -1))
  if (section === 'rejected') rows.sort((a, b) => time(b.rejected_at || b.updated_at) - time(a.rejected_at || a.updated_at))
  if (section === 'recruiting') {
    const pos = (a: T) => (a.current_stage_id ? stagePosition(a.current_stage_id) : Number.MAX_SAFE_INTEGER)
    const inStage = withinStage ?? ((a: T, b: T) => time(a.entered_stage_at || a.created_at) - time(b.entered_stage_at || b.created_at))
    rows.sort((a, b) => pos(a) - pos(b) || inStage(a, b))
  }
  return rows.map((a) => a.candidate_id)
}

/** Previous / next within one list; the ends have none. */
export function neighbours(order: string[], candidateId: string | undefined) {
  const idx = candidateId ? order.indexOf(candidateId) : -1
  return {
    index: idx,
    prev: idx > 0 ? order[idx - 1] : null,
    next: idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null,
  }
}
