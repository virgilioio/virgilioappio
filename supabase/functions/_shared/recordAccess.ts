/**
 * Who may ask a function about a job, candidate or sourcing project
 * (security hotfix, 2026-10-14).
 *
 * Functions that read with the service role must check the caller first:
 * a server-to-server call (service role key) passes; a signed-in user passes
 * only as an active member of the workspace that owns every record named in
 * the request, or as a platform admin. Anyone else gets 401/403 and nothing
 * is read. The browser's own ids are never trusted for the workspace.
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

async function isPlatformAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('members')
    .select('user_type')
    .eq('user_id', userId)
    .eq('user_status', 'active')
    .eq('user_type', 'platform_admin')
    .limit(1)
  return (data ?? []).length > 0
}

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
  const platformAdmin = await isPlatformAdmin(admin, caller.userId)
  if (platformAdmin) return { ok: true, caller, service: false, platformAdmin }

  const checks: Array<Promise<string | null | undefined>> = []
  if (refs.jobId) checks.push(tenantOf(admin, 'jobs', refs.jobId))
  if (refs.candidateId) checks.push(tenantOf(admin, 'candidates', refs.candidateId))
  if (refs.sourcingProjectId) checks.push(projectTenant(admin, refs.sourcingProjectId))

  if (checks.length === 0) {
    if (opts.requireRefs) return { ok: false, status: 403, error: 'Not allowed.' }
    if (caller.memberships.length === 0) return { ok: false, status: 403, error: 'Not allowed.' }
    return { ok: true, caller, service: false, platformAdmin }
  }

  for (const tenant of await Promise.all(checks)) {
    if (tenant === undefined) return { ok: false, status: 404, error: 'Not found.' }
    if (!caller.memberOf(tenant)) return { ok: false, status: 403, error: 'Not allowed.' }
  }
  return { ok: true, caller, service: false, platformAdmin }
}

export function accessDenied(result: Extract<AccessResult, { ok: false }>, headers: Record<string, string>) {
  return new Response(JSON.stringify({ error: result.error }), {
    status: result.status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
