// job-briefing-snapshot — returns the deterministic snapshot, findings, and
// derived health for a job. No LLM call. Used by Phase 3 and for verification.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePreflight, corsHeadersFor } from '../_shared/cors.ts';
import {
  buildJobSnapshot,
  evaluateDetectors,
  deriveHealth,
} from '../_shared/jobBriefing/index.ts';

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cors = corsHeadersFor(req.headers.get('Origin') ?? undefined);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    // Verify the user has access to the job via RLS using their token.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body.job_id === 'string' ? body.job_id : null;
    if (!jobId) return json({ error: 'job_id is required' }, 400);

    const { data: jobRow, error: jobErr } = await userClient
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !jobRow) return json({ error: 'Job not found or access denied' }, 403);

    // Use service role for the heavy snapshot read (cross-table joins).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const { snapshot, snapshot_hash } = await buildJobSnapshot(admin, jobId);
    const findings = evaluateDetectors(snapshot);
    const health = deriveHealth(snapshot, findings);

    return json({ snapshot, snapshot_hash, findings, health });
  } catch (err) {
    console.error('job-briefing-snapshot error', err);
    return json({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});
