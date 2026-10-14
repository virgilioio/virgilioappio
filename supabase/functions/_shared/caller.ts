/**
 * Who is calling an Edge Function, from the signed-in user's own token —
 * never from ids in the request body (Find Phase 0, 2026-10-11).
 *
 * `callerFromRequest` returns the user and their active memberships. A
 * function that acts on a job, project or candidate checks the record's
 * workspace against `memberOf(tenantId)` instead of trusting a tenant the
 * browser sent.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

export interface CallerMembership {
  tenant_id: string
  organization_id: string
  /**
   * May use this workspace's talent pool (job-based access, 2026-10-14):
   * always while the workspace's job_based_access switch is off; otherwise
   * only admins, workspace owners, platform admins and people with a TA or
   * Sourcer seat on a draft or open job.
   */
  talent_pool: boolean
}

export interface Caller {
  userId: string
  platformAdmin: boolean
  memberships: CallerMembership[]
  /** A membership whose talent pool the caller may use, or null. */
  memberOf: (tenantId: string | null | undefined) => CallerMembership | null
  /** Any active membership, talent pool or not (job teams included). */
  belongsTo: (tenantId: string | null | undefined) => CallerMembership | null
}

/** True when the request carries the service role key (a server-to-server call). */
export function isServiceCall(req: Request): boolean {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const auth = req.headers.get('Authorization') ?? ''
  return key.length > 0 && auth === `Bearer ${key}`
}

export async function callerFromRequest(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: auth } }, auth: { persistSession: false } },
  )
  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user) return null
  const userId = data.user.id
  const { data: rows } = await admin
    .from('members')
    .select('tenant_id, organization_id, system_role, user_type')
    .eq('user_id', userId)
    .eq('user_status', 'active')
  const raw = ((rows ?? []) as Array<{ tenant_id: string | null; organization_id: string; system_role: string | null; user_type: string | null }>)
    .filter((m) => m.tenant_id)
  const platformAdmin = raw.some((m) => m.user_type === 'platform_admin')
  const tenantIds = [...new Set(raw.map((m) => m.tenant_id as string))]

  const enforced = new Set<string>()
  const seats = new Set<string>()
  if (tenantIds.length > 0 && !platformAdmin) {
    const [{ data: tenants }, { data: seatRows }] = await Promise.all([
      admin.from('tenants').select('id, settings').in('id', tenantIds),
      admin
        .from('job_assignments')
        .select('role, jobs!inner(tenant_id, status)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .in('role', ['recruiter', 'sourcer'])
        .in('jobs.status', ['draft', 'open']),
    ])
    for (const t of (tenants ?? []) as Array<{ id: string; settings: Record<string, unknown> | null }>) {
      if (t.settings && (t.settings as Record<string, unknown>).job_based_access === true) enforced.add(t.id)
    }
    for (const r of (seatRows ?? []) as Array<{ jobs: { tenant_id: string } | { tenant_id: string }[] }>) {
      const j = Array.isArray(r.jobs) ? r.jobs[0] : r.jobs
      if (j?.tenant_id) seats.add(j.tenant_id)
    }
  }

  const memberships: CallerMembership[] = raw.map((m) => ({
    tenant_id: m.tenant_id as string,
    organization_id: m.organization_id,
    talent_pool:
      platformAdmin ||
      !enforced.has(m.tenant_id as string) ||
      m.system_role === 'admin' ||
      m.user_type === 'workspace_owner' ||
      seats.has(m.tenant_id as string),
  }))
  const find = (tenantId: string | null | undefined) =>
    tenantId ? memberships.find((m) => m.tenant_id === tenantId) ?? null : null
  return {
    userId,
    platformAdmin,
    memberships,
    memberOf: (tenantId) => {
      const m = find(tenantId)
      return m && m.talent_pool ? m : null
    },
    belongsTo: find,
  }
}

/**
 * Whether this user may use this workspace's talent pool (job-based access,
 * 2026-10-14), for functions that resolve the member themselves instead of
 * using callerFromRequest. Same rule as CallerMembership.talent_pool.
 */
export async function talentPoolFor(admin: SupabaseClient, userId: string, tenantId: string): Promise<boolean> {
  const [{ data: member }, { data: tenant }] = await Promise.all([
    admin
      .from('members')
      .select('system_role, user_type')
      .eq('user_id', userId)
      .eq('user_status', 'active')
      .or(`tenant_id.eq.${tenantId},user_type.eq.platform_admin`)
      .limit(5),
    admin.from('tenants').select('settings').eq('id', tenantId).maybeSingle(),
  ])
  const rows = (member ?? []) as Array<{ system_role: string | null; user_type: string | null }>
  if (rows.some((m) => m.user_type === 'platform_admin')) return true
  if (rows.length === 0) return false
  const settings = ((tenant as { settings?: Record<string, unknown> | null } | null)?.settings ?? {}) as Record<string, unknown>
  if (settings.job_based_access !== true) return true
  if (rows.some((m) => m.system_role === 'admin' || m.user_type === 'workspace_owner')) return true
  const { data: seats } = await admin
    .from('job_assignments')
    .select('id, jobs!inner(tenant_id, status)')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .in('role', ['recruiter', 'sourcer'])
    .eq('jobs.tenant_id', tenantId)
    .in('jobs.status', ['draft', 'open'])
    .limit(1)
  return (seats ?? []).length > 0
}

export const TALENT_POOL_REFUSED = 'Finding and working with the talent pool needs a TA or Sourcer seat on an open job.'
