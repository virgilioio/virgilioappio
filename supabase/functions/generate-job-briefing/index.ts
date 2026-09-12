// generate-job-briefing — deterministic snapshot + cached, streamed AI briefing.
// POST { job_id: string, force?: boolean } → SSE DashboardEvent stream.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import {
  buildJobSnapshot,
  evaluateDetectors,
  deriveHealth,
  type JobSnapshot,
  type Finding,
} from '../_shared/jobBriefing/index.ts';
import { AI_MODELS } from '../_shared/aiModels.ts';

const BRIEFING_MODEL = Deno.env.get('BRIEFING_MODEL') ?? AI_MODELS.reasoning;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

type Briefing = {
  paragraph: string;
  ranked_detector_ids: string[];
  status_reason_short: string;
  source: 'llm' | 'template' | 'closed_retrospective' | 'ramping' | 'fallback';
};
type PhaseKey = 'read' | 'snapshot' | 'analyse' | 'write';
type DashboardEvent =
  | { type: 'phase'; phase: PhaseKey; status: 'start' | 'done'; at: number; detail?: string }
  | { type: 'stats'; payload: StatTile[] }
  | { type: 'token'; text: string }
  | { type: 'issues'; payload: Finding[] }
  | { type: 'meta'; payload: { workingWell?: string; updatedAt: string; model: string } }
  | { type: 'cached'; payload: unknown }
  | { type: 'complete'; payload: unknown }
  | { type: 'error'; phase?: PhaseKey; message: string; retryable: boolean };
type StatTile = {
  label: string;
  value: string;
  qualifier: string;
  tone: 'neutral' | 'amber' | 'red' | 'green';
  empty?: boolean;
};

function relativeDays(iso: string | null): string {
  if (!iso) return 'recently';
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

function templateOnTrack(s: JobSnapshot): Briefing {
  const last = relativeDays(s.pipeline.last_activity_at);
  return { paragraph: `Pipeline is moving normally. ${s.pipeline.active_count} active candidate${s.pipeline.active_count === 1 ? '' : 's'}, last activity ${last}.`, ranked_detector_ids: [], status_reason_short: 'on track', source: 'template' };
}
function templateRamping(s: JobSnapshot): Briefing {
  return { paragraph: `This job opened ${s.job.days_open} day${s.job.days_open === 1 ? '' : 's'} ago. Early to judge — check back once candidates start moving.`, ranked_detector_ids: [], status_reason_short: 'ramping up', source: 'ramping' };
}
function templateClosed(s: JobSnapshot): Briefing {
  const hires = s.pipeline.hired_count;
  const total = s.pipeline.active_count + s.pipeline.rejected_count + s.pipeline.withdrawn_count + hires;
  return { paragraph: `Closed after ${s.job.days_open}d with ${hires} hire${hires === 1 ? '' : 's'} from ${total} candidate${total === 1 ? '' : 's'}.`, ranked_detector_ids: [], status_reason_short: s.job.status, source: 'closed_retrospective' };
}
function fallbackParagraph(findings: Finding[]): Briefing {
  return { paragraph: '', ranked_detector_ids: findings.filter((f) => f.severity !== 'positive').map((f) => f.id), status_reason_short: '', source: 'fallback' };
}
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
}
function parseBriefingJson(raw: string): Omit<Briefing, 'source'> | null {
  try {
    const obj = JSON.parse(stripFences(raw));
    if (typeof obj?.paragraph !== 'string' || !Array.isArray(obj?.ranked_detector_ids) || typeof obj?.status_reason_short !== 'string') return null;
    return {
      paragraph: obj.paragraph.trim(),
      ranked_detector_ids: obj.ranked_detector_ids.filter((x: unknown) => typeof x === 'string'),
      status_reason_short: obj.status_reason_short.trim().split(/\s+/).slice(0, 5).join(' '),
    };
  } catch {
    return null;
  }
}

function partialJsonString(raw: string, key: string): string {
  const marker = new RegExp(`"${key}"\\s*:\\s*"`).exec(raw);
  if (!marker) return '';
  const start = (marker.index ?? 0) + marker[0].length;
  let encoded = '';
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const char = raw[i];
    if (!escaped && char === '"') break;
    encoded += char;
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
  }
  if (encoded.endsWith('\\')) encoded = encoded.slice(0, -1);
  const unicodeTail = encoded.match(/\\u[0-9a-fA-F]{0,3}$/);
  if (unicodeTail?.index != null) encoded = encoded.slice(0, unicodeTail.index);
  try { return JSON.parse(`"${encoded}"`); } catch { return ''; }
}

function buildStatTiles(s: JobSnapshot, health: ReturnType<typeof deriveHealth>): StatTile[] {
  const inbound = s.pipeline.active_inbound_total ?? s.pipeline.inbound_total;
  const sourced = s.pipeline.active_sourced_total ?? s.pipeline.sourced_total;
  const unknown = s.pipeline.active_unknown_source_total ?? s.pipeline.unknown_source_total ?? 0;
  const activeQualifier = s.pipeline.active_count === 0
    ? 'no candidates yet'
    : inbound === 0 && sourced > 0
      ? 'all sourced, none inbound'
      : inbound === 0 && sourced === 0 && unknown > 0
        ? `${unknown} uncategorized source${unknown === 1 ? '' : 's'}`
        : sourced === 0
          ? (unknown ? `${inbound} inbound · ${unknown} unknown` : 'all inbound')
          : `${inbound} inbound · ${sourced} sourced${unknown ? ` · ${unknown} unknown` : ''}`;
  const activeTone: StatTile['tone'] = (inbound === 0 && (sourced > 0 || unknown > 0)) ? 'amber' : 'neutral';
  const closest = s.pipeline.stages.flatMap((stage) => {
    const distance = s.pipeline.stages_from_offer[stage.stage] ?? 99;
    return distance <= 2 && stage.stage_type !== 'offer' && stage.stage_type !== 'onboarding' ? stage.candidates : [];
  });
  const maxWait = closest.reduce((max, candidate) => Math.max(max, candidate.days_in_stage ?? 0), 0);
  const closestQualifier = closest.length === 0 ? 'no one near offer yet' : maxWait >= 7 ? `waiting ${maxWait}d in final review` : 'within 2 stages of offer';
  let projected: StatTile = { label: 'Projected fill', value: '—', qualifier: 'no target set', tone: 'neutral', empty: true };
  if (s.job.target_fill_date) {
    const days = Math.ceil((new Date(s.job.target_fill_date).getTime() - Date.now()) / 86_400_000);
    const noMovement = s.velocity.transitions_last_7d === 0 && s.pipeline.active_count > 0;
    projected = days < 0
      ? { label: 'Projected fill', value: `${Math.abs(days)}d over`, qualifier: 'past target fill date', tone: 'red' }
      : noMovement
        ? { label: 'Projected fill', value: '—', qualifier: 'no forecast without movement', tone: 'red', empty: true }
        : health.status === 'on_track'
          ? { label: 'Projected fill', value: `${days}d`, qualifier: 'on target', tone: 'green' }
          : { label: 'Projected fill', value: `${days}d`, qualifier: 'to target fill date', tone: 'neutral' };
  }
  return [
    { label: 'Active candidates', value: String(s.pipeline.active_count), qualifier: activeQualifier, tone: activeTone },
    { label: 'Closest to offer', value: String(closest.length), qualifier: closestQualifier, tone: maxWait >= 7 ? 'red' : 'neutral' },
    projected,
  ];
}

const SYSTEM_PROMPT = `You are writing a 60–90 word hiring briefing for a recruiter.

Hard rules:
- You may ONLY reference facts and numbers present in the input JSON. Never estimate, extrapolate, or add advice beyond the fired detectors.
- Treat the snapshot as the source of truth for this job's current pipeline. Use stage counts, candidate days-in-stage, source mix, stage conversion, movement velocity, scorecards, and interviews when they are present.
- Do not call a pipeline thin when active candidates exist in meaningful later-stage volume, recent forward movement exists, or scorecards/interviews show an active process.
- Rank the fired detectors by what unblocks a hire fastest; lead the paragraph with the top one.
- Tone: direct, plain language, no hedging, no pleasantries. Write like a sharp recruiting lead, not a report.
- Output STRICT JSON only, no markdown fences, matching this exact shape:
  { "paragraph": "string, 60-90 words",
    "ranked_detector_ids": ["string", ...],
    "status_reason_short": "string, max 5 words, for a status pill" }`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Service configuration unavailable' }, 500);

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const jobId = typeof body.job_id === 'string' ? body.job_id : null;
  const force = body.force === true;
  if (!jobId) return json({ error: 'job_id is required' }, 400);
  const { data: jobRow, error: jobErr } = await userClient.from('jobs').select('id').eq('id', jobId).maybeSingle();
  if (jobErr || !jobRow) return json({ error: 'Job not found or access denied' }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let activePhase: PhaseKey = 'read';
      const emit = (event: DashboardEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      const phase = (key: PhaseKey, status: 'start' | 'done', at: number, detail?: string) => emit({ type: 'phase', phase: key, status, at, ...(detail ? { detail } : {}) });
      const fail = (message: string, retryable = true) => emit({ type: 'error', phase: activePhase, message, retryable });
      try {
        const readStarted = Date.now();
        const { snapshot, snapshot_hash } = await buildJobSnapshot(admin, jobId);
        const readEnded = Date.now();
        const findings = evaluateDetectors(snapshot);
        const health = deriveHealth(snapshot, findings);
        const candidateCount = snapshot.pipeline.active_count + snapshot.pipeline.rejected_count + snapshot.pipeline.withdrawn_count + snapshot.pipeline.hired_count;
        const readDetail = `${candidateCount} candidates · ${snapshot.pipeline.stages.length} stages · 14 days of activity`;
        const stats = buildStatTiles(snapshot, health);

        if (!force) {
          const { data: cached } = await admin.from('job_briefings').select('snapshot, snapshot_hash, briefing, generated_at').eq('job_id', jobId).maybeSingle();
          if (cached && cached.snapshot_hash === snapshot_hash) {
            const payload = { snapshot, snapshot_hash, findings, health, briefing: cached.briefing, generated_at: cached.generated_at, cached: true };
            emit({ type: 'cached', payload });
            emit({ type: 'complete', payload });
            controller.close();
            return;
          }
        }

        phase('read', 'start', readStarted);
        phase('read', 'done', readEnded, readDetail);
        emit({ type: 'stats', payload: stats });
        emit({ type: 'issues', payload: findings });

        const nonPositive = findings.filter((finding) => finding.severity !== 'positive');
        const jobStatus = (snapshot.job.status ?? '').toLowerCase();
        let briefing: Briefing;

        if (jobStatus === 'closed' || jobStatus === 'filled' || jobStatus === 'archived' || health.status === 'ramping_up' || (nonPositive.length === 0 && health.status === 'on_track')) {
          activePhase = 'write';
          const writeStarted = Date.now();
          phase('write', 'start', writeStarted, 'Verdict first, then the evidence behind it');
          briefing = jobStatus === 'closed' || jobStatus === 'filled' || jobStatus === 'archived'
            ? templateClosed(snapshot)
            : health.status === 'ramping_up'
              ? templateRamping(snapshot)
              : templateOnTrack(snapshot);
          emit({ type: 'token', text: briefing.paragraph });
        } else {
          if (!OPENAI_API_KEY) throw new Error('The briefing model is not configured.');
          activePhase = 'analyse';
          const analyseStarted = Date.now();
          phase('analyse', 'start', analyseStarted);
          const requestBody = {
            model: BRIEFING_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: JSON.stringify({ snapshot, fired_detectors: findings.map((finding) => ({ id: finding.id, severity: finding.severity, evidence: finding.evidence })) }) },
            ],
            reasoning_effort: 'medium',
            max_completion_tokens: 4000,
            stream: true,
            stream_options: { include_usage: true },
          };

          let provider: Response | null = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            provider = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: req.signal,
            });
            if (provider.ok || (provider.status !== 429 && provider.status < 500)) break;
            await provider.text();
            provider = null;
          }
          if (!provider?.ok) {
            const providerMessage = provider ? await provider.text() : '';
            console.error('briefing provider error', provider?.status, providerMessage.slice(0, 500));
            throw new Error(provider?.status === 429 ? 'The model is busy. Please try again.' : 'The model could not finish the briefing.');
          }
          if (!provider.body) throw new Error('The model returned no response stream.');

          const reader = provider.body.getReader();
          const decoder = new TextDecoder();
          let sseBuffer = '';
          let rawContent = '';
          let emittedParagraph = '';
          let firstContentAt: number | null = null;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;
              try {
                const packet = JSON.parse(trimmed.slice(6));
                const content = packet?.choices?.[0]?.delta?.content;
                if (typeof content !== 'string' || !content) continue;
                if (firstContentAt == null) {
                  firstContentAt = Date.now();
                  phase('analyse', 'done', firstContentAt);
                  activePhase = 'write';
                  phase('write', 'start', firstContentAt, 'Verdict first, then the evidence behind it');
                }
                rawContent += content;
                const nextParagraph = partialJsonString(rawContent, 'paragraph');
                if (nextParagraph.length > emittedParagraph.length) {
                  emit({ type: 'token', text: nextParagraph.slice(emittedParagraph.length) });
                  emittedParagraph = nextParagraph;
                }
              } catch {
                // Ignore malformed provider frames; the final payload is validated below.
              }
            }
          }
          if (firstContentAt == null) throw new Error('The model returned an empty briefing.');
          const parsed = parseBriefingJson(rawContent);
          if (!parsed) throw new Error('The model returned an incomplete briefing.');
          if (parsed.paragraph.length > emittedParagraph.length) emit({ type: 'token', text: parsed.paragraph.slice(emittedParagraph.length) });
          briefing = { ...parsed, source: 'llm' };
        }

        const generatedAt = new Date().toISOString();
        const { error: upsertError } = await admin.from('job_briefings').upsert({ job_id: jobId, snapshot_hash, snapshot, briefing, generated_at: generatedAt });
        if (upsertError) console.error('job_briefings upsert failed', upsertError);
        if (activePhase === 'write') phase('write', 'done', Date.now());
        const workingWellFinding = findings.find((finding) => finding.id === 'fast_decisions');
        const workingWell = workingWellFinding ? `Screening decisions are fast — rejected candidates got an answer in ${String(workingWellFinding.evidence.median_days_to_rejection)}d median.` : undefined;
        emit({ type: 'meta', payload: { ...(workingWell ? { workingWell } : {}), updatedAt: generatedAt, model: briefing.source === 'llm' ? BRIEFING_MODEL : briefing.source } });
        const payload = { snapshot, snapshot_hash, findings, health, briefing, generated_at: generatedAt, cached: false };
        emit({ type: 'complete', payload });
        controller.close();
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError';
        if (!aborted) {
          const message = error instanceof Error ? error.message : 'Gio could not finish this briefing.';
          fail(message, true);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
});
