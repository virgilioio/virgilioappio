import { supabase } from '@/lib/supabaseClient'
import { addCandidateToJob } from '@/lib/addCandidateToJob'
import { mapLimit } from '@/lib/parallel'
import { requestFitAnalysis } from '@/utils/triggerFitAnalysis'

/**
 * Adding people from Find (Allan, 2026-10-22): one action for one row or many,
 * into the talent pool or a job. Apollo previews are collected (1 credit each,
 * enrich-apollo-profile, which also puts them in the job); PDL people are saved
 * as candidates first; people already in Gio only need the job. With no job
 * they simply stay in the pool. Anyone added to an open job gets Gio Fit
 * (unless the job turned scoring off).
 */

export type FindAddTarget =
  | { kind: 'pool' }
  | { kind: 'job'; jobId: string; jobTitle: string; stageId?: string | null; stageName?: string | null }

export interface FindPerson {
  /** The row's own key in Find, reported back in FindAddResult.ok. */
  key: string
  /** Our candidate id when the person is already in Gio. */
  candidateId: string | null
  /** Apollo id of a preview not yet collected. */
  apolloId: string | null
  kind: 'internal' | 'preview' | 'pdl'
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the PDL row as the search returned it
  pdl?: Record<string, any>
}

export interface FindAddResult {
  added: number
  alreadyIn: number
  failed: number
  /** apollo_id -> candidate_id for previews collected now. */
  collected: Map<string, string>
  /** apollo_id -> real name for previews collected now. */
  names: Map<string, string>
  candidateIds: string[]
  /** Keys of the people now in the target (added now or already there). */
  ok: Set<string>
  error?: string
}

/** Credits a set of people costs: one per Apollo preview. */
export const creditsFor = (people: FindPerson[]) => people.filter((p) => p.kind === 'preview').length

async function savePdlPerson(pdl: Record<string, unknown>): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- profiles isn't in the generated types here
  const client: any = supabase
  const { data: profile } = await client.from('profiles').select('organization_id').eq('id', user!.id).single()
  if (!profile?.organization_id) throw new Error('No organization found')
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null)
  const { data, error } = await supabase
    .from('candidates')
    .insert({
      candidate_name: str(pdl.full_name) || str(pdl.candidate_name) || 'Unknown',
      email: str(pdl.email),
      phone: str(pdl.phone),
      linkedin_url: str(pdl.linkedin_url),
      current_job_title: str(pdl.current_role) || str(pdl.current_title),
      company_current: str(pdl.current_company),
      location_city: str(pdl.location_city),
      location_state: str(pdl.location_state),
      location_country: str(pdl.location_country),
      profile_summary: str(pdl.summary) || str(pdl.profile_summary),
      skills: Array.isArray(pdl.skills) ? (pdl.skills as string[]) : null,
      years_experience: (pdl.years_experience as number) || (pdl.experience_years as number) || null,
      source: 'pdl' as const,
      organization_id: profile.organization_id,
      created_by: user!.id,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Gio Fit for everyone just added to an open job (job_settings.auto_score on). */
export async function queueGioFit(jobId: string, candidateIds: string[]): Promise<void> {
  if (!candidateIds.length) return
  const [{ data: job }, { data: settings }] = await Promise.all([
    supabase.from('jobs').select('status').eq('id', jobId).maybeSingle(),
    supabase.from('job_settings').select('auto_score').eq('job_id', jobId).maybeSingle(),
  ])
  if (job?.status !== 'open' || settings?.auto_score === false) return
  // In the background, three at a time; a failure leaves the job's own Refresh.
  void mapLimit(candidateIds, 3, (id) => requestFitAnalysis(id, jobId).catch(() => 'failed' as const))
}

export async function addFromFind(people: FindPerson[], target: FindAddTarget, projectId: string | null): Promise<FindAddResult> {
  const result: FindAddResult = { added: 0, alreadyIn: 0, failed: 0, collected: new Map(), names: new Map(), candidateIds: [], ok: new Set() }
  const jobId = target.kind === 'job' ? target.jobId : null
  const stageId = target.kind === 'job' ? target.stageId ?? null : null

  // 1. Apollo previews: one collect call for all of them (it also adds them to the job).
  const previews = people.filter((p) => p.kind === 'preview' && p.apolloId)
  if (previews.length) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.functions.invoke('enrich-apollo-profile', {
      body: { apollo_ids: previews.map((p) => p.apolloId), job_id: jobId, stage_id: stageId, sourcing_project_id: projectId, user_id: user?.id },
    })
    if (error) {
      result.failed += previews.length
      result.error = /CREDITS_EXHAUSTED/.test(error.message || '') ? 'credits' : 'collect'
    } else {
      const keyOf = new Map(previews.map((p) => [p.apolloId!, p.key]))
      type CollectRow = { apollo_id?: string; candidate_id?: string; candidate_name?: string; already_collected?: boolean }
      for (const r of (data?.results ?? []) as CollectRow[]) {
        if (!r?.apollo_id) continue
        if (r.candidate_id) {
          const k = keyOf.get(r.apollo_id)
          if (k) result.ok.add(k)
          result.collected.set(r.apollo_id, r.candidate_id)
          result.candidateIds.push(r.candidate_id)
          if (r.candidate_name) result.names.set(r.apollo_id, r.candidate_name)
          if (r.already_collected) result.alreadyIn++
          else result.added++
        } else result.failed++
      }
    }
  }

  // 2. PDL people are saved first; 3. people in Gio only need the job.
  const others = people.filter((p) => p.kind !== 'preview')
  await mapLimit(others, 4, async (p) => {
    try {
      let candidateId = p.candidateId
      if (!candidateId && p.kind === 'pdl' && p.pdl) candidateId = await savePdlPerson(p.pdl)
      if (!candidateId) { result.failed++; return }
      if (!jobId) {
        // The pool: someone already in Gio is already there.
        if (p.kind === 'internal') result.alreadyIn++
        else { result.added++; result.candidateIds.push(candidateId) }
        result.ok.add(p.key)
        return
      }
      const added = await addCandidateToJob(jobId, candidateId, stageId)
      result.ok.add(p.key)
      if (added) { result.added++; result.candidateIds.push(candidateId) }
      else result.alreadyIn++
    } catch {
      result.failed++
    }
  })

  if (jobId) await queueGioFit(jobId, result.candidateIds)
  return result
}

/** The toast line for an add: "3 added to CSM · Cadmus · 1 was already there". */
export function addSummary(r: FindAddResult, target: FindAddTarget): string {
  const where = target.kind === 'job' ? target.jobTitle : 'the talent pool'
  const parts = [`${r.added} added to ${where}`]
  if (r.alreadyIn) parts.push(`${r.alreadyIn} ${r.alreadyIn === 1 ? 'was' : 'were'} already there`)
  if (r.failed) parts.push(`${r.failed} couldn't be added`)
  return parts.join(' · ')
}
