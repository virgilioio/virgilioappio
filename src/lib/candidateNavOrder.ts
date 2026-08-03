/**
 * Candidate profile arrow-navigation order.
 *
 * The pipeline board owns the "true" candidate order (stage by stage, top to
 * bottom). When a profile is opened from the board we freeze that order in
 * sessionStorage so the in-profile prev/next arrows follow the exact same
 * sequence — and stay stable even if the candidate you're on gets rejected.
 */

const KEY = 'gio:candidateNavOrder'

interface StoredNavOrder {
  jobId: string
  order: string[]
  savedAt: number
}

export function saveCandidateNavOrder(jobId: string, order: string[]) {
  if (!jobId || !order || order.length === 0) return
  try {
    const payload: StoredNavOrder = { jobId, order, savedAt: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable — navigation falls back to derived order
  }
}

export function readCandidateNavOrder(jobId: string): string[] | null {
  if (!jobId) return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredNavOrder
    if (!parsed || parsed.jobId !== jobId || !Array.isArray(parsed.order)) return null
    return parsed.order.filter((id) => typeof id === 'string' && id.length > 0)
  } catch {
    return null
  }
}

export function clearCandidateNavOrder() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

const ACTIVE_STATUSES = new Set(['active', 'in_process', 'in_progress'])

interface OrderableCandidate {
  id: string
  current_stage_id?: string | null
  association_status?: string | null
  association_created_at?: string | null
  created_at?: string | null
}

/**
 * Fallback ordering used when no board snapshot exists (deep link, refresh,
 * entry from the candidates table). Mirrors the board: active candidates
 * grouped by stage in stage order, then everything else (offered / hired /
 * rejected) at the end. Within a group we keep the newest-first order the
 * data source already provides.
 */
export function buildStageOrderedIds<T extends OrderableCandidate>(
  candidates: T[],
  stageOrder: string[],
): string[] {
  const stageIndex = new Map<string, number>()
  stageOrder.forEach((jhsId, i) => stageIndex.set(jhsId, i))

  const active: T[] = []
  const rest: T[] = []
  for (const c of candidates) {
    const status = (c.association_status || '').toLowerCase()
    if (!status || ACTIVE_STATUSES.has(status)) active.push(c)
    else rest.push(c)
  }

  const rank = (c: T) => {
    const idx = c.current_stage_id ? stageIndex.get(c.current_stage_id) : undefined
    return idx === undefined ? Number.MAX_SAFE_INTEGER : idx
  }

  const sortedActive = active
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map((x) => x.c)

  return [...sortedActive, ...rest].map((c) => c.id)
}
