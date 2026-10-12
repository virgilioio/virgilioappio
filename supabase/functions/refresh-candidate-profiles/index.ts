/**
 * Refresh candidates from Apollo (Find Phase 3, 2026-10-12).
 *
 * Two ways in:
 * - "Refresh profile · 1 credit" on a profile: a signed-in member, one
 *   candidate of their own workspace.
 * - The daily job (pg_cron with the x-pool-secret header, checked against
 *   Vault): people active in an open job's pipeline or shortlisted, with
 *   nothing fresher than 90 days, oldest first. It spends at most the
 *   workspace's monthly cap (apollo_credit_plans.refresh_cap_credits,
 *   1,000 by default) spread over the days left in the Apollo cycle.
 *
 * Never asks for phones (1 credit a person). Everything Apollo says goes
 * through apply_candidate_update(): gaps filled, source values refreshed, a
 * person's edits kept, job changes recorded. Someone Apollo can't match is
 * still marked refreshed, so the daily job doesn't retry them every day.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { callerFromRequest, isServiceCall } from "../_shared/caller.ts";
import { creditStatus, creditsFromResponse, recordCredits } from "../_shared/apolloCredits.ts";
import { applyCandidateUpdate, apolloPersonFields, addHistoryIfEmpty, type ApplyResult } from "../_shared/candidateUpdate.ts";

const APOLLO_API_KEY = Deno.env.get('APOLLO_API_KEY');
const APOLLO_BULK_MATCH_URL = 'https://api.apollo.io/api/v1/people/bulk_match';
const BATCH = 10;              // Apollo's limit per bulk_match
const RUN_MAX = 100;           // people per daily run, whatever the budget
const DOUBLE_CLICK_MS = 10 * 60 * 1000;
const SCHEDULED_NOTE = 'Scheduled refresh';

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

interface CandidateRow {
  id: string
  tenant_id: string
  candidate_name: string | null
  apollo_id: string | null
  linkedin_url: string | null
  email: string | null
  profile_refreshed_at: string | null
}

interface Outcome {
  candidate_id: string
  matched: boolean
  result: ApplyResult | null
}

function json(body: unknown, status: number, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function scheduledCall(req: Request): Promise<boolean> {
  if (isServiceCall(req)) return true;
  const key = req.headers.get('x-pool-secret') ?? '';
  if (key.length < 32) return false;
  const { data, error } = await admin.rpc('pool_builder_secret_matches', { p_secret: key });
  return !error && data === true;
}

function slug(url: string | null | undefined): string | null {
  const m = (url ?? '').match(/linkedin\.com\/(?:in|pub)\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

/** Asks Apollo about up to 10 people at a time and applies what comes back. */
async function refresh(
  db: SupabaseClient,
  tenantId: string,
  rows: CandidateRow[],
  actor: string | null,
  note: string,
): Promise<{ outcomes: Outcome[]; credits: number }> {
  const outcomes: Outcome[] = [];
  let credits = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const details = chunk.map((c) => {
      const d: Record<string, string> = {};
      if (c.apollo_id) d.id = c.apollo_id;
      if (c.linkedin_url) d.linkedin_url = c.linkedin_url;
      if (c.email) d.email = c.email;
      if (c.candidate_name) d.name = c.candidate_name;
      return d;
    });

    const res = await fetch(APOLLO_BULK_MATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': APOLLO_API_KEY! },
      body: JSON.stringify({ details }),
    });
    if (!res.ok) {
      console.error('Apollo bulk_match failed:', res.status, await res.text());
      throw new Error(res.status === 429 ? 'Apollo is busy. Try again in a minute.' : "Apollo didn't answer.");
    }
    const body = await res.json();
    // deno-lint-ignore no-explicit-any
    const matches: any[] = Array.isArray(body?.matches) ? body.matches : [];
    const found = matches.filter(Boolean).length;
    const cost = creditsFromResponse(body, found);
    credits += cost.credits;
    await recordCredits(db, {
      tenantId, kind: 'refresh', people: found, credits: cost.credits, estimated: cost.estimated,
      userId: actor, candidateId: chunk.length === 1 ? chunk[0].id : null, note,
    });

    for (let j = 0; j < chunk.length; j++) {
      const c = chunk[j];
      // Apollo answers in the order asked; check it's the same person anyway.
      // deno-lint-ignore no-explicit-any
      const byOrder = matches.length === chunk.length ? matches[j] : null;
      // deno-lint-ignore no-explicit-any
      const person = [byOrder, ...matches].find((p: any) => p && (
        (c.apollo_id && p.id === c.apollo_id) ||
        (slug(c.linkedin_url) && slug(p.linkedin_url) === slug(c.linkedin_url)) ||
        (c.email && typeof p.email === 'string' && p.email.toLowerCase() === c.email.toLowerCase())
      )) ?? null;

      if (!person) {
        await db.from('candidates').update({ profile_refreshed_at: new Date().toISOString() }).eq('id', c.id);
        outcomes.push({ candidate_id: c.id, matched: false, result: null });
        continue;
      }
      const result = await applyCandidateUpdate(db, c.id, 'apollo', {
        ...apolloPersonFields(person),
        refreshed: true,
      }, { mode: 'refresh', actor });
      await addHistoryIfEmpty(db, c.id, person);
      outcomes.push({ candidate_id: c.id, matched: true, result });
    }
  }
  return { outcomes, credits };
}

const CANDIDATE_COLUMNS = 'id, tenant_id, candidate_name, apollo_id, linkedin_url, email, profile_refreshed_at';

async function refreshOne(req: Request, cors: Record<string, string>, body: Record<string, unknown>) {
  const caller = await callerFromRequest(req, admin);
  if (!caller) return json({ error: 'Sign in to refresh profiles' }, 401, cors);

  const candidateId = typeof body.candidate_id === 'string' ? body.candidate_id : null;
  if (!candidateId) return json({ error: 'Which candidate?' }, 400, cors);

  const { data: c } = await admin
    .from('candidates')
    .select(CANDIDATE_COLUMNS)
    .eq('id', candidateId)
    .is('deleted_at', null)
    .is('merged_into', null)
    .maybeSingle();
  if (!c || !caller.memberOf(c.tenant_id)) return json({ error: 'Candidate not found' }, 404, cors);
  if (!c.apollo_id && !slug(c.linkedin_url) && !c.email) {
    return json({ error: 'Add a LinkedIn URL or an email first, so Apollo can find this person.', error_code: 'NOTHING_TO_MATCH' }, 400, cors);
  }
  if (c.profile_refreshed_at && Date.now() - new Date(c.profile_refreshed_at).getTime() < DOUBLE_CLICK_MS) {
    return json({ already_fresh: true, refreshed_at: c.profile_refreshed_at, credits_used: 0 }, 200, cors);
  }

  const status = await creditStatus(admin, c.tenant_id);
  if (!status.configured || status.remaining < 1) {
    return json({ error: 'No Apollo credits left this cycle.', error_code: 'CREDITS_EXHAUSTED' }, 429, cors);
  }

  const { outcomes, credits } = await refresh(admin, c.tenant_id, [c as CandidateRow], caller.userId, 'Refresh profile');
  const o = outcomes[0];
  return json({
    matched: o?.matched ?? false,
    applied: o?.result?.applied ?? [],
    kept: o?.result?.kept ?? {},
    job_change: o?.result?.job_change ?? null,
    credits_used: credits,
    credits_remaining: Math.max(0, status.remaining - credits),
  }, 200, cors);
}

async function refreshScheduled(body: Record<string, unknown>) {
  const dryRun = body.dry_run === true;
  const { data: plans, error } = await admin.from('apollo_credit_plans').select('tenant_id, refresh_cap_credits');
  if (error) return json({ error: error.message }, 500);

  const report: Record<string, unknown>[] = [];
  for (const plan of plans ?? []) {
    const tenantId = plan.tenant_id as string;
    const cap = Number(plan.refresh_cap_credits ?? 0);
    const status = await creditStatus(admin, tenantId);
    if (!status.configured || cap <= 0 || !status.cycle_start || !status.cycle_end) {
      report.push({ tenant_id: tenantId, skipped: 'no plan or no cap' });
      continue;
    }

    const { data: spentRows } = await admin
      .from('apollo_credit_ledger')
      .select('credits, created_at')
      .eq('tenant_id', tenantId)
      .eq('kind', 'refresh')
      .eq('note', SCHEDULED_NOTE)
      .gte('created_at', status.cycle_start);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    let usedCycle = 0;
    let usedToday = 0;
    for (const r of spentRows ?? []) {
      usedCycle += Number(r.credits ?? 0);
      if (new Date(r.created_at as string) >= startOfDay) usedToday += Number(r.credits ?? 0);
    }

    const daysLeft = Math.max(1, Math.ceil((new Date(status.cycle_end).getTime() - Date.now()) / 86_400_000));
    const capLeft = Math.max(0, cap - usedCycle);
    const today = Math.ceil((capLeft + usedToday) / daysLeft) - usedToday;
    const budget = Math.max(0, Math.min(today, status.remaining, RUN_MAX));

    const { data: due, error: dueErr } = await admin.rpc('candidates_due_for_refresh', { p_tenant: tenantId, p_limit: Math.max(budget, 0) });
    if (dueErr) {
      report.push({ tenant_id: tenantId, error: dueErr.message });
      continue;
    }
    const ids = ((due ?? []) as { candidate_id: string }[]).map((d) => d.candidate_id);
    const line: Record<string, unknown> = { tenant_id: tenantId, cap, used_this_cycle: usedCycle, days_left: daysLeft, budget, due: ids.length };
    if (dryRun || ids.length === 0 || budget === 0) {
      report.push(line);
      continue;
    }

    const { data: rows } = await admin.from('candidates').select(CANDIDATE_COLUMNS).in('id', ids);
    try {
      const { outcomes, credits } = await refresh(admin, tenantId, (rows ?? []) as CandidateRow[], null, SCHEDULED_NOTE);
      line.refreshed = outcomes.filter((o) => o.matched).length;
      line.not_found = outcomes.filter((o) => !o.matched).length;
      line.job_changes = outcomes.filter((o) => o.result?.job_change).length;
      line.credits = credits;
    } catch (e) {
      line.error = e instanceof Error ? e.message : String(e);
    }
    report.push(line);
  }
  return json({ dry_run: dryRun, tenants: report }, 200);
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const origin = req.headers.get('Origin') ?? req.headers.get('origin') ?? undefined;
  const cors = corsHeadersFor(origin);

  try {
    if (!APOLLO_API_KEY) return json({ error: 'Apollo is not configured' }, 500, cors);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (body.mode === 'scheduled') {
      if (!(await scheduledCall(req))) return json({ error: 'Not allowed' }, 401);
      return await refreshScheduled(body);
    }
    return await refreshOne(req, cors, body);
  } catch (e) {
    console.error('refresh-candidate-profiles failed:', e);
    return json({ error: e instanceof Error ? e.message : "Couldn't refresh" }, 500, cors);
  }
});
