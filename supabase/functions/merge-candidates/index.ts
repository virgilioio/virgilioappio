import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const CANDIDATE_KEYS = [
  'candidate_name', 'email', 'phone', 'location_city', 'location_state', 'location_country',
  'current_job_title', 'company_current', 'linkedin_url', 'salary_amount', 'salary_currency',
  'salary_period', 'years_experience', 'profile_summary', 'source',
]

const blank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Normalise the add-candidate form payload onto real candidate columns. */
function normaliseIncoming(raw: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const k of CANDIDATE_KEYS) if (!blank(raw[k])) out[k] = raw[k]
  if (blank(out.current_job_title) && !blank(raw.current_role)) out.current_job_title = raw.current_role
  if (blank(out.current_job_title) && !blank(raw.role_current)) out.current_job_title = raw.role_current
  if (blank(out.company_current) && !blank(raw.current_company)) out.company_current = raw.current_company
  if (Array.isArray(raw.skills)) out.skills = raw.skills.filter((s: unknown) => typeof s === 'string' && s.trim())
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid body' }, 400)

    const action: string = body.action ?? 'merge'
    const survivingId: string | undefined = body.surviving_candidate_id ?? body.existing_candidate_id
    if (!survivingId || typeof survivingId !== 'string') {
      return json({ error: 'surviving_candidate_id is required' }, 400)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: existing } = await admin
      .from('candidates')
      .select('id, tenant_id, organization_id, candidate_name, email, phone')
      .eq('id', survivingId)
      .maybeSingle()
    if (!existing) return json({ error: 'Candidate not found' }, 404)

    // ── caller must be an active member of this candidate's tenant, with edit rights ──
    const { data: member } = await admin
      .from('members')
      .select('id, tenant_id, system_role, user_status, user_type')
      .eq('user_id', user.id)
      .eq('tenant_id', existing.tenant_id)
      .maybeSingle()
    const { data: tenantRow } = await admin
      .from('tenants').select('id, owner_id').eq('id', existing.tenant_id).maybeSingle()

    const isOwner = tenantRow?.owner_id === user.id
    if (!isOwner && (!member || member.user_status !== 'active')) {
      return json({ error: 'Forbidden' }, 403)
    }
    const canWrite =
      isOwner ||
      member?.user_type === 'platform_admin' ||
      member?.user_type === 'workspace_owner' ||
      ['admin', 'member'].includes(String(member?.system_role ?? ''))
    if (!canWrite) {
      return json({ error: 'Your role cannot edit candidates' }, 403)
    }

    const incoming = normaliseIncoming(body.incoming ?? {})

    // ── "Not the same person": create a separate candidate and suppress the pair ──
    if (action === 'not_duplicate') {
      const insertRow: Record<string, any> = {
        candidate_name: incoming.candidate_name ?? body.incoming?.candidate_name ?? 'Unnamed candidate',
        email: incoming.email ?? null,
        phone: incoming.phone ?? null,
        location_city: incoming.location_city ?? null,
        location_state: incoming.location_state ?? null,
        location_country: incoming.location_country ?? null,
        current_job_title: incoming.current_job_title ?? null,
        company_current: incoming.company_current ?? null,
        linkedin_url: incoming.linkedin_url ?? null,
        salary_amount: incoming.salary_amount ?? null,
        salary_currency: incoming.salary_currency ?? null,
        salary_period: incoming.salary_period ?? null,
        years_experience: incoming.years_experience ?? null,
        profile_summary: incoming.profile_summary ?? null,
        skills: incoming.skills ?? null,
        source: incoming.source ?? 'direct',
        status: 'active',
        created_by: user.id,
        organization_id: body.organization_id ?? existing.organization_id,
        tenant_id: existing.tenant_id,
      }

      const { data: created, error: createErr } = await admin
        .from('candidates').insert(insertRow).select('id').single()
      if (createErr) {
        console.error('[merge-candidates] not_duplicate insert failed:', createErr)
        return json({ error: createErr.message }, 500)
      }

      await admin.from('candidate_duplicate_decisions').upsert({
        tenant_id: existing.tenant_id,
        candidate_id: survivingId,
        other_candidate_id: created.id,
        match_email: incoming.email ?? null,
        match_phone: incoming.phone ?? null,
        match_name: incoming.candidate_name ?? null,
        decision: 'not_duplicate',
        decided_by: user.id,
      }, { onConflict: 'candidate_id,other_candidate_id,match_email,match_phone', ignoreDuplicates: true })

      // suppress against the incoming signature alone too, so a re-add never re-asks
      await admin.from('candidate_duplicate_decisions').insert({
        tenant_id: existing.tenant_id,
        candidate_id: survivingId,
        other_candidate_id: null,
        match_email: incoming.email ?? null,
        match_phone: incoming.phone ?? null,
        match_name: incoming.candidate_name ?? null,
        decision: 'not_duplicate',
        decided_by: user.id,
      }).then(() => null, () => null)

      // optional: place the new candidate on the job the recruiter was adding to
      if (body.job_id) {
        await admin.from('job_candidate_associations').insert({
          job_id: body.job_id,
          candidate_id: created.id,
          current_stage_id: body.stage_id ?? null,
          notes: body.notes ?? null,
          status: 'active',
          added_by: user.id,
        }).then(() => null, () => null)
      }

      return json({ candidate_id: created.id, created_separate: true })
    }

    // ── the merge itself: one transaction inside the database ──
    const resolutions: Record<string, 'existing' | 'incoming'> = {}
    for (const [k, v] of Object.entries(body.resolutions ?? {})) {
      if (CANDIDATE_KEYS.includes(k) && (v === 'existing' || v === 'incoming')) {
        resolutions[k] = v
      }
    }

    const { data: result, error: mergeErr } = await admin.rpc('merge_candidate_payload', {
      p_surviving: survivingId,
      p_incoming: incoming,
      p_resolutions: resolutions,
      p_actor: user.id,
      p_merged: body.merged_candidate_id ?? null,
      p_resume: body.resume_attachment ?? null,
    })

    if (mergeErr) {
      console.error('[merge-candidates] merge failed:', mergeErr)
      return json({ error: mergeErr.message }, 500)
    }

    // place the merged record on the job the recruiter was adding to, if any
    if (body.job_id) {
      const { data: already } = await admin
        .from('job_candidate_associations')
        .select('id')
        .eq('job_id', body.job_id)
        .eq('candidate_id', survivingId)
        .maybeSingle()
      if (!already) {
        const { error: assocErr } = await admin.from('job_candidate_associations').insert({
          job_id: body.job_id,
          candidate_id: survivingId,
          current_stage_id: body.stage_id ?? null,
          notes: body.notes ?? null,
          status: 'active',
          added_by: user.id,
        })
        if (assocErr) console.error('[merge-candidates] association insert failed:', assocErr)
      }
    }

    return json(result)
  } catch (err) {
    console.error('[merge-candidates] failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500)
  }
})
