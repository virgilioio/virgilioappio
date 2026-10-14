/**
 * Who may ask a function about a job, candidate or sourcing project
 * (security hotfix 2026-10-14; job-based access 2026-10-14).
 *
 * Functions that read with the service role must check the caller first:
 * - a server-to-server call (service role key) passes;
 * - a platform admin passes;
 * - a signed-in user passes when they may use the talent pool of the
 *   workspace that owns every record named (Caller.memberOf: always while the
 *   workspace's job_based_access switch is off; admins and TA/Sourcer seats
 *   on draft or open jobs while it is on);
 * - otherwise a job team member passes for their own job, and for a
 *   candidate who is in one of their jobs (the same job, when both are named).
 * Anyone else gets 401/403 and nothing is read. The browser's own ids are
 * never trusted for the workspace.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { callerFromRequest, isServiceCall, type Caller } from './caller.ts'

export interface RecordRefs {
  jobId?: string | null
  candidateId?: string | null
  sourcingProjectId?: string | null
}

export type AccessResult =
  | { ok: true; caller: Caller | null; service: boolean; platformAdmin: boolean }
  | { ok: false; status: 401 | 403 | 404; error: string }

async function tenantOf(admin: SupabaseClient, table: 'jobs' | 'candidates', id: string): Promise<string | null | undefined> {
  const { data } = await admin.from(table).select('tenant_id').eq('id', id).maybeSingle()
  return data ? (data as { tenant_id: string | null }).tenant_id : undefined
}

async function projectTenant(admin: SupabaseClient, id: string): Promise<string | null | undefined> {
  const { data: project } = await admin
    .from('sourcing_projects')
    .select('organization_id, job_id')
    .eq('id', id)
    .maybeSingle()
  if (!project) return undefined
  const p = project as { organization_id: string | null; job_id: string | null }
  if (p.job_id) return tenantOf(admin, 'jobs', p.job_id)
  if (!p.organization_id) return null
  const { data: org } = await admin.from('organizations').select('tenant_id').eq('id', p.organization_id).maybeSingle()
  return org ? (org as { tenant_id: string | null }).tenant_id : null
}

async function myJobIds(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from('job_assignments')
    .select('job_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
  return ((data ?? []) as Array<{ job_id: string }>).map((r) => r.job_id)
}

/** Job team fallback: the caller's own job, or a candidate in one of their jobs. */
async function jobTeamAllows(admin: SupabaseClient, caller: Caller, refs: RecordRefs): Promise<boolean> {
  if (refs.sourcingProjectId) return false
  if (!refs.jobId && !refs.candidateId) return false
  const jobs = await myJobIds(admin, caller.userId)
  if (jobs.length === 0) return false
  if (refs.jobId && !jobs.includes(refs.jobId)) return false
  if (refs.candidateId) {
    const scope = refs.jobId ? [refs.jobId] : jobs
    const { data } = await admin
      .from('job_candidate_associations')
      .select('id')
      .eq('candidate_id', refs.candidateId)
      .in('job_id', scope)
      .limit(1)
    if (!data || data.length === 0) return false
  }
  return true
}

/**
 * `requireRefs`: when true, a user call that names no record is refused
 * unless the caller is a platform admin (used for batch modes).
 */
export async function checkRecordAccess(
  req: Request,
  admin: SupabaseClient,
  refs: RecordRefs,
  opts: { requireRefs?: boolean } = {},
): Promise<AccessResult> {
  if (isServiceCall(req)) return { ok: true, caller: null, service: true, platformAdmin: false }

  const caller = await callerFromRequest(req, admin)
  if (!caller) return { ok: false, status: 401, error: 'Sign in to continue.' }
  if (caller.platformAdmin) return { ok: true, caller, service: false, platformAdmin: true }

  const checks: Array<Promise<string | null | undefined>> = []
  if (refs.jobId) checks.push(tenantOf(admin, 'jobs', refs.jobId))
  if (refs.candidateId) checks.push(tenantOf(admin, 'candidates', refs.candidateId))
  if (refs.sourcingProjectId) checks.push(projectTenant(admin, refs.sourcingProjectId))

  if (checks.length === 0) {
    if (opts.requireRefs) return { ok: false, status: 403, error: 'Not allowed.' }
    // No record named (e.g. counting matches): a talent-pool search.
    if (!caller.memberships.some((m) => m.talent_pool)) return { ok: false, status: 403, error: 'Not allowed.' }
    return { ok: true, caller, service: false, platformAdmin: false }
  }

  const tenants = await Promise.all(checks)
  if (tenants.some((t) => t === undefined)) return { ok: false, status: 404, error: 'Not found.' }
  if (tenants.every((t) => caller.memberOf(t))) return { ok: true, caller, service: false, platformAdmin: false }
  if (tenants.every((t) => caller.belongsTo(t)) && (await jobTeamAllows(admin, caller, refs))) {
    return { ok: true, caller, service: false, platformAdmin: false }
  }
  return { ok: false, status: 403, error: 'Not allowed.' }
}

export function accessDenied(result: Extract<AccessResult, { ok: false }>, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
