// generate-job-briefing — deterministic snapshot + cached LLM briefing.
//
// Contract:
//   POST { job_id: string, force?: boolean }
//   →    { snapshot, snapshot_hash, findings, health, briefing, generated_at, cached }
//
// Flow:
//   1. Build snapshot (deterministic SQL).
//   2. Compute snapshot_hash. If a cached row matches AND !force → return cached.
//   3. Run detectors.
//   4. If status === 'on_track' AND no fired detectors → template paragraph, no LLM.
//   5. Otherwise call Lovable AI gateway. Parse defensively, retry once on failure.
//   6. Persist to job_briefings, return.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePreflight, corsHeadersFor } from '../_shared/cors.ts';
import {
  buildJobSnapshot,
  evaluateDetectors,
  deriveHealth,
  type JobSnapshot,
  type Finding,
  type HealthStatus,
} from '../_shared/jobBriefing/index.ts';

const BRIEFING_MODEL = Deno.env.get('BRIEFING_MODEL') ?? 'google/gemini-2.5-flash';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

type Briefing = {
  paragraph: string;
  ranked_detector_ids: string[];
  status_reason_short: string;
  source: 'llm' | 'template' | 'closed_retrospective' | 'ramping' | 'fallback';
};

// ---------- helpers --------------------------------------------------------

function relativeDays(iso: string | null): string {
  if (!iso) return 'recently';
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

function templateOnTrack(s: JobSnapshot): Briefing {
  const last = relativeDays(s.pipeline.last_activity_at);
  return {
    paragraph: `Pipeline is moving normally. ${s.pipeline.active_count} active candidate${s.pipeline.active_count === 1 ? '' : 's'}, last activity ${last}.`,
    ranked_detector_ids: [],
    status_reason_short: 'on track',
    source: 'template',
  };
}

function templateRamping(s: JobSnapshot): Briefing {
  return {
    paragraph: `This job opened ${s.job.days_open} day${s.job.days_open === 1 ? '' : 's'} ago. Early to judge — check back once candidates start moving.`,
    ranked_detector_ids: [],
    status_reason_short: 'ramping up',
    source: 'ramping',
  };
}

function templateClosed(s: JobSnapshot): Briefing {
  const hires = s.pipeline.hired_count;
  const total = s.pipeline.active_count + s.pipeline.rejected_count + s.pipeline.withdrawn_count + hires;
  return {
    paragraph: `Closed after ${s.job.days_open}d with ${hires} hire${hires === 1 ? '' : 's'} from ${total} candidate${total === 1 ? '' : 's'}.`,
    ranked_detector_ids: [],
    status_reason_short: s.job.status,
    source: 'closed_retrospective',
  };
}

function fallbackParagraph(findings: Finding[]): Briefing {
  return {
    paragraph: '',
    ranked_detector_ids: findings.filter((f) => f.severity !== 'positive').map((f) => f.id),
    status_reason_short: '',
    source: 'fallback',
  };
}

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}

function parseBriefingJson(raw: string): Omit<Briefing, 'source'> | null {
  try {
    const obj = JSON.parse(stripFences(raw));
    if (typeof obj?.paragraph !== 'string') return null;
    if (!Array.isArray(obj?.ranked_detector_ids)) return null;
    if (typeof obj?.status_reason_short !== 'string') return null;
    return {
      paragraph: obj.paragraph.trim(),
      ranked_detector_ids: obj.ranked_detector_ids.filter((x: unknown) => typeof x === 'string'),
      status_reason_short: obj.status_reason_short.trim().split(/\s+/).slice(0, 5).join(' '),
    };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are writing a 60–90 word hiring briefing for a recruiter.

Hard rules:
- You may ONLY reference facts and numbers present in the input JSON. Never estimate, extrapolate, or add advice beyond the fired detectors.
- Rank the fired detectors by what unblocks a hire fastest; lead the paragraph with the top one.
- Tone: direct, plain language, no hedging, no pleasantries. Write like a sharp recruiting lead, not a report.
- Output STRICT JSON only, no markdown fences, matching this exact shape:
  { "paragraph": "string, 60-90 words",
    "ranked_detector_ids": ["string", ...],
    "status_reason_short": "string, max 5 words, for a status pill" }`;

async function callLlm(snapshot: JobSnapshot, findings: Finding[]): Promise<Briefing | null> {
  if (!LOVABLE_API_KEY) {
    console.warn('generate-job-briefing: LOVABLE_API_KEY missing, degrading to fallback');
    return null;
  }
  const userPayload = {
    snapshot,
    fired_detectors: findings.map((f) => ({ id: f.id, severity: f.severity, evidence: f.evidence })),
  };
  const body = {
    model: BRIEFING_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error('briefing gateway error', res.status, txt);
        if (res.status === 429 || res.status === 402) return null; // surface as fallback
        continue;
      }
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const parsed = parseBriefingJson(content);
      if (parsed) return { ...parsed, source: 'llm' };
      console.warn(`briefing parse failed attempt ${attempt}`, content?.slice(0, 200));
    } catch (err) {
      console.error('briefing call exception attempt', attempt, err);
    }
  }
  return null;
}

// ---------- main handler --------------------------------------------------

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cors = corsHeadersFor(req.headers.get('Origin') ?? undefined);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const jobId = typeof body.job_id === 'string' ? body.job_id : null;
    const force = !!body.force;
    if (!jobId) return json({ error: 'job_id is required' }, 400);

    // RLS gate: confirm the caller can see the job.
    const { data: jobRow, error: jobErr } = await userClient
      .from('jobs').select('id').eq('id', jobId).maybeSingle();
    if (jobErr || !jobRow) return json({ error: 'Job not found or access denied' }, 403);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // 1. Snapshot
    const { snapshot, snapshot_hash } = await buildJobSnapshot(admin, jobId);

    // 2. Cache check
    if (!force) {
      const { data: cached } = await admin
        .from('job_briefings')
        .select('snapshot, snapshot_hash, briefing, generated_at')
        .eq('job_id', jobId)
        .maybeSingle();
      if (cached && cached.snapshot_hash === snapshot_hash) {
        const findings = evaluateDetectors(snapshot);
        const health = deriveHealth(snapshot, findings);
        return json({
          snapshot,
          snapshot_hash,
          findings,
          health,
          briefing: cached.briefing,
          generated_at: cached.generated_at,
          cached: true,
        });
      }
    }

    // 3. Detectors + health
    const findings = evaluateDetectors(snapshot);
    const health = deriveHealth(snapshot, findings);

    // 4. Decide source: template vs LLM
    let briefing: Briefing;
    const nonPositive = findings.filter((f) => f.severity !== 'positive');
    const jobStatus = (snapshot.job.status ?? '').toLowerCase();

    if (jobStatus === 'closed' || jobStatus === 'filled' || jobStatus === 'archived') {
      briefing = templateClosed(snapshot);
    } else if (health.status === 'ramping_up') {
      briefing = templateRamping(snapshot);
    } else if (nonPositive.length === 0 && health.status === 'on_track') {
      briefing = templateOnTrack(snapshot);
    } else {
      const llm = await callLlm(snapshot, findings);
      briefing = llm ?? fallbackParagraph(findings);
    }

    const generatedAt = new Date().toISOString();

    // 5. Persist (best-effort)
    const { error: upErr } = await admin.from('job_briefings').upsert({
      job_id: jobId,
      snapshot_hash,
      snapshot,
      briefing,
      generated_at: generatedAt,
    });
    if (upErr) console.error('job_briefings upsert failed', upErr);

    return json({
      snapshot,
      snapshot_hash,
      findings,
      health,
      briefing,
      generated_at: generatedAt,
      cached: false,
    });
  } catch (err) {
    console.error('generate-job-briefing error', err);
    return json({ error: (err as Error).message ?? 'Internal error' }, 500);
  }
});
