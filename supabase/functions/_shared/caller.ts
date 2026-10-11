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
}

export interface Caller {
  userId: string
  memberships: CallerMembership[]
  memberOf: (tenantId: string | null | undefined) => CallerMembership | null
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
    .select('tenant_id, organization_id')
    .eq('user_id', userId)
    .eq('user_status', 'active')
  const memberships = (rows ?? []).filter((m: CallerMembership) => m.tenant_id) as CallerMembership[]
  return {
    userId,
    memberships,
    memberOf: (tenantId) => (tenantId ? memberships.find((m) => m.tenant_id === tenantId) ?? null : null),
  }
}
