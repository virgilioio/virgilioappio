/**
 * Collect (Find, Phase 0 — 2026-10-11).
 *
 * - Who and which workspace come from the signed-in user, never the body.
 *   A job or project in the request must belong to one of their workspaces.
 * - People we already have (same Apollo id) are never paid for again; they
 *   are added to the job and marked collected in the project.
 * - After Apollo answers, each person is matched again by LinkedIn and email
 *   (find_candidate_matches), so someone added by hand, by the extension or
 *   through an application is filled in, not duplicated.
 * - Credits: the balance is apollo_credit_status(); every Apollo call writes
 *   what Apollo reported to apollo_credit_ledger. Collect costs 1 a person;
 *   with_phone asks for the mobile too (8 more, charged when it arrives).
 * - The project's state lives in sourcing_project_candidates, so a search
 *   refresh never loses who was collected.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { callerFromRequest, isServiceCall } from "../_shared/caller.ts";
import { findExistingCandidate } from "../_shared/matchCandidate.ts";
import { apolloCompany } from "../_shared/apolloPerson.ts";
import { applyCandidateUpdate, apolloPersonFields, addHistoryIfEmpty, apolloWorkHistory } from "../_shared/candidateUpdate.ts";
import {
  creditStatus, creditsFromResponse, recordCredits, phoneWebhookUrl,
  PERSON_CREDITS, PHONE_CREDITS,
} from "../_shared/apolloCredits.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';
const APOLLO_BATCH_SIZE = 10; // Apollo's limit per request

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// deno-lint-ignore no-explicit-any
type ApolloPerson = any;

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

async function bulkMatch(ids: string[], webhook: string | null): Promise<{ ok: boolean; body: any; status: number; text?: string }> {
  const res = await fetch(APOLLO_BULK_MATCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': APOLLO_API_KEY! },
    body: JSON.stringify({
      details: ids.map((id) => ({ id })),
      ...(webhook ? { reveal_phone_number: true, webhook_url: webhook } : {}),
    }),
  });
  if (!res.ok) return { ok: false, body: null, status: res.status, text: await res.text() };
  return { ok: true, body: await res.json(), status: res.status };
}

/** Adds a candidate to the job's entry stage unless already there. */
async function addToJob(db: SupabaseClient, jobId: string, candidateId: string, stageId: string | undefined, userId: string) {
  const { data: assoc } = await db
    .from('job_candidate_associations')
    .select('id')
    .eq('candidate_id', candidateId)
    .eq('job_id', jobId)
    .maybeSingle();
  if (assoc) return;
  // Application Review when the job has it, else its first stage.
  let target = stageId;
  if (!target) {
    const { data: entry } = await db.rpc('job_entry_stage', { p_job: jobId });
    target = entry ?? undefined;
  }
  const { error } = await db.from('job_candidate_associations').insert({
    candidate_id: candidateId,
    job_id: jobId,
    current_stage_id: target,
    status: 'active',
    added_by: userId,
  });
  if (error) console.warn('Add to job failed:', error.message);
}

/** Marks the person collected in the project (state table + cache row). */
async function markCollected(db: SupabaseClient, projectId: string, apolloId: string, candidateId: string, userId: string, at: string, pool = false) {
  const { data: row } = await db
    .from('sourcing_project_candidates')
    .select('id, collected_at')
    .eq('sourcing_project_id', projectId)
    .eq('apollo_id', apolloId)
    .maybeSingle();
  if (row) {
    const { error } = await db
      .from('sourcing_project_candidates')
      .update({ candidate_id: candidateId, collected_at: row.collected_at ?? at, collected_by: userId })
      .eq('id', row.id);
    if (error) console.warn('Project state update failed:', error.message);
  } else {
    const { error } = await db.from('sourcing_project_candidates').insert({
      sourcing_project_id: projectId,
      tenant_id: '00000000-0000-0000-0000-000000000000', // set by the trigger from the project
      apollo_id: apolloId,
      candidate_id: candidateId,
      collected_at: at,
      collected_by: userId,
      added_by_pool: pool,
    });
    if (error) console.warn('Project state insert failed:', error.message);
  }
  // The search cache still shows the badge until the app reads the state table.
  await db
    .from('sourcing_preview_candidates')
    .update({ collected_at: at })
    .eq('sourcing_project_id', projectId)
    .eq('apollo_id', apolloId)
    .is('collected_at', null);
}

function phonesOf(person: ApolloPerson) {
  const contactPhones = (person.phone_numbers || []).map((p: any) => ({
    type: p.type || 'other',
    number: p.sanitized_number || p.raw_number || '',
    raw_number: p.raw_number || null,
  })).filter((p: any) => p.number);
  return { phone: contactPhones[0]?.number || null, contactPhones };
}

function emailsOf(person: ApolloPerson) {
  const list: any[] = [];
  if (person.email) list.push({ type: 'work', email: person.email, status: person.email_status || null });
  for (const e of (Array.isArray(person.personal_emails) ? person.personal_emails : [])) {
    if (e && e !== person.email) list.push({ type: 'personal', email: e, status: null });
  }
  return list;
}

/**
 * Someone we already have: Apollo's data goes through apply_candidate_update()
 * (Find Phase 3), which fills gaps, refreshes what a source set, never
 * replaces a person's edit, and records a job change if there is one.
 */
async function fillExisting(db: SupabaseClient, candidateId: string, person: ApolloPerson, actor: string | null) {
  await applyCandidateUpdate(db, candidateId, 'apollo', {
    ...apolloPersonFields(person),
    apollo_collected_at: true,
  }, { mode: 'refresh', actor });
  await addHistoryIfEmpty(db, candidateId, person);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    if (!APOLLO_API_KEY) return json({ error: 'Apollo is not configured' }, 500, cors);

    // The pool builder calls with the service key (Find Phase 2); everyone
    // else signs in, and only reaches their own workspaces.
    const service = isServiceCall(req);
    const caller = service ? null : await callerFromRequest(req, supabase);
    if (!service && !caller) return json({ error: 'Sign in to collect' }, 401, cors);
    const memberOf = (tenant: string | null | undefined) => (service ? !!tenant : !!caller!.memberOf(tenant));

    const body = await req.json();
    const pool = service && body.pool === true;
    const requested: string[] = (Array.isArray(body.apollo_ids) ? body.apollo_ids : body.apollo_id ? [body.apollo_id] : [])
      .filter((x: unknown): x is string => typeof x === 'string' && x.length > 0);
    const ids = Array.from(new Set(requested));
    const jobId: string | null = body.job_id || null;
    const stageId: string | undefined = body.stage_id || undefined;
    const projectId: string | null = body.sourcing_project_id || null;
    // Phones cost Apollo 8 credits each on top of the 1 for the person, so
    // Collect asks for them only on "Collect with phone" and "Get phone".
    const withPhone = body.with_phone === true && !pool;
    if (ids.length === 0) return json({ error: 'apollo_ids is required' }, 400, cors);

    // ── Workspace: from the job or project, checked against the caller ──
    let tenantId: string | null = null;
    let organizationId: string | null = null;
    let projectOwner: string | null = null;
    if (jobId) {
      const { data: job } = await supabase.from('jobs').select('organization_id, tenant_id').eq('id', jobId).maybeSingle();
      if (!job || !memberOf(job.tenant_id)) return json({ error: 'Job not found' }, 404, cors);
      tenantId = job.tenant_id;
      organizationId = job.organization_id;
    }
    if (projectId) {
      const { data: project } = await supabase
        .from('sourcing_projects')
        .select('organization_id, created_by, organizations!inner(tenant_id)')
        .eq('id', projectId)
        .maybeSingle();
      const projectTenant = (project as any)?.organizations?.tenant_id ?? null;
      if (!project || !memberOf(projectTenant) || (tenantId && tenantId !== projectTenant)) {
        return json({ error: 'Sourcing project not found' }, 404, cors);
      }
      tenantId = projectTenant;
      organizationId = organizationId ?? project.organization_id;
      projectOwner = (project as any).created_by ?? null;
    }
    if (!tenantId && service) return json({ error: 'sourcing_project_id is required' }, 400, cors);
    if (!tenantId) {
      const m = caller!.memberships.find((x) => x.talent_pool);
      if (!m) {
        return json({ error: caller!.memberships.length ? 'Finding people needs a TA or Sourcer seat on an open job.' : 'You are not an active member of a workspace' }, 403, cors);
      }
      tenantId = m.tenant_id;
      organizationId = m.organization_id;
    }

    // Who did it: the signed-in user, or for the pool the project's owner.
    const userId: string | null = caller?.userId
      ?? (typeof body.acting_user_id === 'string' ? body.acting_user_id : projectOwner);
    if (!userId) return json({ error: 'No one to record this collect against' }, 400, cors);

    const status = await creditStatus(supabase, tenantId);
    if (!status.configured) {
      return json({ error: "Apollo credits aren't set up for this workspace", error_code: 'CREDITS_NOT_SET_UP', credits_remaining: 0 }, 403, cors);
    }
    let remaining = status.remaining;
    let spent = 0;
    const at = new Date().toISOString();
    const results: any[] = [];

    // ── People we already have: no charge ──
    const { data: existing } = await supabase
      .from('candidates')
      .select('id, apollo_id, phone, candidate_name, linkedin_url, apollo_collected_at')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .is('merged_into', null)
      .in('apollo_id', ids);
    const have = new Map((existing ?? []).map((c: any) => [c.apollo_id as string, c]));

    for (const c of have.values()) {
      if (!c.apollo_collected_at) {
        await supabase.from('candidates').update({ apollo_collected_at: at }).eq('id', c.id).is('apollo_collected_at', null);
      }
      if (jobId) await addToJob(supabase, jobId, c.id, stageId, userId);
      if (projectId) await markCollected(supabase, projectId, c.apollo_id, c.id, userId, at, pool);
      results.push({
        apollo_id: c.apollo_id,
        candidate_id: c.id,
        already_collected: true,
        candidate_name: c.candidate_name ?? null,
        linkedin_url: c.linkedin_url ?? null,
      });
    }

    // "Get phone" / "Collect with phone" for people we have without one.
    let phoneRequested = 0;
    if (withPhone) {
      const perPerson = PERSON_CREDITS + PHONE_CREDITS;
      const needPhone = [...have.values()].filter((c: any) => !c.phone).map((c: any) => c.apollo_id as string)
        .slice(0, Math.floor(remaining / perPerson));
      const webhook = await phoneWebhookUrl(tenantId, userId, projectId);
      for (const batch of chunk(needPhone, APOLLO_BATCH_SIZE)) {
        const r = await bulkMatch(batch, webhook);
        if (!r.ok) { console.error('Apollo phone request failed:', r.status, r.text); continue; }
        const matched = (r.body?.matches || []).filter(Boolean).length;
        const cost = creditsFromResponse(r.body, matched * PERSON_CREDITS);
        await recordCredits(supabase, { tenantId, kind: 'phone', people: matched, credits: cost.credits, estimated: cost.estimated, userId, projectId, note: 'Phone requested; 8 more per phone when it arrives' });
        spent += cost.credits;
        remaining -= cost.credits;
        phoneRequested += matched;
        for (const res of results) if (batch.includes(res.apollo_id)) res.phone_requested = true;
      }
    }

    // ── New people: pay Apollo, then save each one ──
    const newIds = ids.filter((id) => !have.has(id));
    if (newIds.length === 0) {
      return json({
        results, enriched_count: 0, credits_used: spent, credits_remaining: Math.max(0, remaining),
        phone_requested: phoneRequested,
        message: phoneRequested > 0 ? 'Phone requested' : 'All candidates were already collected',
      }, 200, cors);
    }

    const perPerson = withPhone ? PERSON_CREDITS + PHONE_CREDITS : PERSON_CREDITS;
    const affordable = Math.max(0, Math.floor(remaining / perPerson));
    if (affordable === 0) {
      return json({ error: 'Monthly credit limit reached', error_code: 'CREDITS_EXHAUSTED', credits_remaining: Math.max(0, remaining), results }, 429, cors);
    }
    const toCollect = newIds.slice(0, affordable);
    const skipped = newIds.length - toCollect.length;
    const webhook = withPhone ? await phoneWebhookUrl(tenantId, userId, projectId) : null;

    let enriched = 0;
    let merged = 0;
    for (const batch of chunk(toCollect, APOLLO_BATCH_SIZE)) {
      const r = await bulkMatch(batch, webhook);
      if (!r.ok) {
        console.error('Apollo collect failed:', r.status, r.text);
        for (const id of batch) results.push({ apollo_id: id, error: "Apollo didn't return this person", already_collected: false });
        continue;
      }
      const matches: ApolloPerson[] = (r.body?.matches || []).filter(Boolean);
      const cost = creditsFromResponse(r.body, matches.length * PERSON_CREDITS);
      await recordCredits(supabase, { tenantId, kind: 'collect', people: matches.length, credits: cost.credits, estimated: cost.estimated, userId, projectId, note: pool ? 'Talent pool' : withPhone ? 'Collect with phone' : 'Collect' });
      spent += cost.credits;
      remaining -= cost.credits;

      for (const person of matches) {
        // Someone already here under another key (LinkedIn, email)? A strong
        // match with nothing contradicting it is filled in; anything weaker
        // becomes its own record for the Possible duplicates queue.
        const existingMatch = await findExistingCandidate(supabase, tenantId, {
          candidate_name: person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
          apollo_id: person.id,
          linkedin_url: person.linkedin_url ?? null,
          email: person.email ?? null,
          company_current: apolloCompany(person),
        });
        let candidateId: string | null = existingMatch?.id ?? null;
        let wasExisting = !!candidateId;

        if (candidateId) {
          await fillExisting(supabase, candidateId, person, pool ? null : userId);
          merged++;
        } else {
          const { phone, contactPhones } = phonesOf(person);
          const { data: created, error: insertError } = await supabase
            .from('candidates')
            .insert({
              apollo_id: person.id,
              candidate_name: person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim(),
              email: person.email,
              email_status: person.email_status,
              phone,
              contact_phones: contactPhones,
              contact_emails: emailsOf(person),
              linkedin_url: person.linkedin_url,
              role_current: person.title,
              current_job_title: person.title,
              company_current: apolloCompany(person),
              location_city: person.city,
              location_state: person.state,
              location_country: person.country,
              bio: person.headline,
              source: 'apollo',
              organization_id: organizationId,
              tenant_id: tenantId,
              created_by: userId,
              apollo_collected_at: at,
            })
            .select('id')
            .single();
          if (insertError) {
            // Two collects at once: the other one saved it first.
            const { data: again } = await supabase
              .from('candidates').select('id')
              .eq('tenant_id', tenantId).eq('apollo_id', person.id)
              .is('deleted_at', null).is('merged_into', null)
              .maybeSingle();
            if (!again) {
              console.error('Saving the candidate failed:', insertError.message);
              results.push({ apollo_id: person.id, error: "Couldn't save this person", already_collected: false });
              continue;
            }
            candidateId = again.id;
            wasExisting = true;
          } else {
            candidateId = created.id;
            enriched++;
            const history = apolloWorkHistory(candidateId!, person);
            if (history.length > 0) {
              const { error: expError } = await supabase.from('candidate_work_experience').insert(history);
              if (expError) console.warn('Saving work history failed:', expError.message);
            }
          }
        }

        if (jobId) await addToJob(supabase, jobId, candidateId!, stageId, userId);
        if (projectId) await markCollected(supabase, projectId, person.id, candidateId!, userId, at, pool);

        const { phone } = phonesOf(person);
        results.push({
          apollo_id: person.id,
          candidate_id: candidateId,
          already_collected: wasExisting,
          merged_into_existing: wasExisting,
          candidate_name: person.name || `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || null,
          linkedin_url: person.linkedin_url || null,
          email: person.email,
          phone,
          headline: person.headline,
          seniority: person.seniority,
          departments: person.departments,
          email_status: person.email_status,
          employment_history: person.employment_history,
          apollo_collected_at: at,
          phone_requested: withPhone,
        });
      }
    }

    return json({
      results,
      enriched_count: enriched,
      merged_count: merged,
      skipped_for_credits: skipped,
      credits_used: spent,
      credits_remaining: Math.max(0, remaining),
      phone_requested: phoneRequested + (withPhone ? enriched + merged : 0),
    }, 200, cors);
  } catch (error) {
    console.error('Collect error:', error);
    return json({ error: "Couldn't collect right now. Try again in a moment." }, 500, cors);
  }
});
