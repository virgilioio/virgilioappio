/**
 * AI fit, on the shortlist only (Find Phase 2, 2026-10-12).
 *
 * Scores the people shortlisted in a sourcing project against the project's
 * search and, when it has one, the linked job. Results live on the project
 * row (sourcing_project_candidates.ai_fit_*), with a fingerprint of what they
 * were scored against so a changed search or job rescores them.
 *
 * - People we already have are scored on their full profile and work history.
 * - Apollo previews have only a title and company until collected; they are
 *   scored on that, conservatively, and say so in their gaps.
 * - Caller must belong to the project's workspace.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { callerFromRequest } from "../_shared/caller.ts";
import { openaiFetch } from "../_shared/openaiFetch.ts";
import { AI_MODELS } from "../_shared/aiModels.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const BATCH = 10;
const MAX_PER_CALL = 40;

const SYSTEM_PROMPT = `You are a senior recruiter at Virgilio, an agency that hires sales and go-to-market people (SDRs, AEs, revenue leaders) in LATAM, the US and EMEA.
Score how well each person fits the role from 0 to 100 using only the evidence given:
- 85+: clearly the right title, level, market and context; worth calling today.
- 70-84: good fit with a gap or two to check.
- 55-69: plausible but uncertain.
- below 55: unlikely.
Weigh current title and seniority most, then relevant sales motion (inbound/outbound, SMB/mid-market/enterprise, deal size) and industry, then location fit.
People marked "preview" have only a title and company: never score them above 75, and list "Only title and company known until collected" as a gap.
Write the summary as one plain sentence a recruiter can act on (max 200 characters). Strengths and gaps: up to 3 each, a few words each, specific. Never invent facts that are not in the evidence.`;

const TOOL = {
  type: 'function',
  function: {
    name: 'submit_fits',
    description: 'One fit assessment per person, keyed by the key given.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        fits: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              key: { type: 'string' },
              score: { type: 'integer', minimum: 0, maximum: 100 },
              summary: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              gaps: { type: 'array', items: { type: 'string' } },
            },
            required: ['key', 'score', 'summary', 'strengths', 'gaps'],
          },
        },
      },
      required: ['fits'],
    },
  },
};

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const cors = corsHeadersFor(req.headers.get('Origin') ?? undefined);

  try {
    if (!OPENAI_API_KEY) return json({ error: 'AI scoring is not configured' }, 500, cors);
    const caller = await callerFromRequest(req, admin);
    if (!caller) return json({ error: 'Sign in to score the shortlist' }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const projectId: string | null = typeof body.sourcing_project_id === 'string' ? body.sourcing_project_id : null;
    const force = body.force === true;
    if (!projectId) return json({ error: 'sourcing_project_id is required' }, 400, cors);

    const { data: project } = await admin
      .from('sourcing_projects')
      .select('id, name, job_id, search_criteria, organizations!inner(tenant_id)')
      .eq('id', projectId)
      .maybeSingle();
    const tenantId = (project as any)?.organizations?.tenant_id ?? null;
    if (!project || !caller.memberOf(tenantId)) return json({ error: 'Project not found' }, 404, cors);

    let job: any = null;
    if (project.job_id) {
      const { data } = await admin
        .from('jobs')
        .select('id, title, description, location, location_requirement, work_mode, employment_type, must_have_skills, skills, salary_min, salary_max, currency, updated_at')
        .eq('id', project.job_id)
        .maybeSingle();
      job = data;
    }
    const criteria = project.search_criteria ?? {};
    const basis = await sha256(JSON.stringify({
      t: criteria.title_keywords ?? [], l: criteria.locations ?? [], s: criteria.seniorities ?? [],
      k: criteria.keywords ?? [], c: [...(criteria.user_company_names ?? []), ...(criteria.company_names ?? [])],
      j: job ? [job.id, job.updated_at] : null,
    }));

    const { data: rows, error: rowsError } = await admin
      .from('sourcing_project_candidates')
      .select('id, apollo_id, candidate_id, snapshot, ai_fit_basis, ai_fit_at')
      .eq('sourcing_project_id', projectId)
      .eq('status', 'shortlisted');
    if (rowsError) throw rowsError;
    const todo = (rows ?? []).filter((r: any) => force || !r.ai_fit_at || r.ai_fit_basis !== basis).slice(0, MAX_PER_CALL);
    if (todo.length === 0) return json({ scored: 0, remaining: 0, basis }, 200, cors);

    // Full profiles for people we already have.
    const candIds = todo.map((r: any) => r.candidate_id).filter(Boolean);
    const profiles = new Map<string, any>();
    const history = new Map<string, any[]>();
    if (candIds.length > 0) {
      const { data: cands } = await admin
        .from('candidates')
        .select('id, candidate_name, role_current, current_job_title, company_current, location_city, location_country, seniority_level, years_experience, skills, profile_summary, bio')
        .in('id', candIds);
      for (const c of cands ?? []) profiles.set(c.id, c);
      const { data: work } = await admin
        .from('candidate_work_experience')
        .select('candidate_id, company_name, job_title, start_date, end_date, is_current')
        .in('candidate_id', candIds)
        .order('start_date', { ascending: false });
      for (const w of work ?? []) {
        const l = history.get(w.candidate_id) ?? [];
        if (l.length < 5) l.push(w);
        history.set(w.candidate_id, l);
      }
    }

    const role = [
      `ROLE: ${clip(job?.title, 160) || clip((criteria.title_keywords ?? [])[0], 160) || clip(project.name, 160)}`,
      `Titles searched: ${list(criteria.title_keywords).join(', ') || 'any'}`,
      `Locations: ${list(criteria.locations).join(', ') || 'any'}`,
      `Seniority: ${list(criteria.seniorities).join(', ') || 'any'}`,
      list(criteria.keywords).length ? `Keywords: ${list(criteria.keywords).join(', ')}` : '',
      job?.must_have_skills ? `Must-haves: ${list(job.must_have_skills).join(', ')}` : '',
      job?.location_requirement || job?.work_mode ? `Location requirement: ${clip(job?.location_requirement, 200)} ${clip(job?.work_mode, 40)}` : '',
      job?.description ? `Job description: ${clip(job.description, 3000)}` : '',
    ].filter(Boolean).join('\n');

    const people = todo.map((r: any) => {
      const c = r.candidate_id ? profiles.get(r.candidate_id) : null;
      if (c) {
        const work = (history.get(c.id) ?? []).map((w: any) =>
          `${clip(w.job_title, 80)} at ${clip(w.company_name, 80)} (${w.start_date ?? '?'} – ${w.is_current ? 'now' : w.end_date ?? '?'})`).join('; ');
        return {
          key: r.id,
          kind: 'profile',
          text: [
            `Current: ${clip(c.role_current || c.current_job_title, 120)} at ${clip(c.company_current, 120)}`,
            `Location: ${[c.location_city, c.location_country].filter(Boolean).join(', ') || 'unknown'}`,
            c.seniority_level ? `Seniority: ${c.seniority_level}` : '',
            c.years_experience ? `Years of experience: ${c.years_experience}` : '',
            work ? `Work history: ${work}` : '',
            list(c.skills).length ? `Skills: ${list(c.skills).slice(0, 15).join(', ')}` : '',
            c.profile_summary || c.bio ? `Summary: ${clip(c.profile_summary || c.bio, 700)}` : '',
          ].filter(Boolean).join('\n'),
        };
      }
      const s = r.snapshot ?? {};
      return {
        key: r.id,
        kind: 'preview',
        text: [
          `Current: ${clip(s.title || s.headline, 120) || 'unknown'} at ${clip(s.company, 120) || 'unknown'}`,
          s.location ? `Location: ${clip(s.location, 120)}` : 'Location: within the searched locations',
        ].join('\n'),
      };
    });

    let scored = 0;
    const results: any[] = [];
    for (let i = 0; i < people.length; i += BATCH) {
      const batch = people.slice(i, i + BATCH);
      const userContent = `${role}\n\n---\nPEOPLE\n${batch.map((p) => `[key ${p.key}] (${p.kind})\n${p.text}`).join('\n\n')}`;
      const res = await openaiFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AI_MODELS.reasoning,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userContent }],
          tools: [TOOL],
          tool_choice: { type: 'function', function: { name: 'submit_fits' } },
          reasoning_effort: 'low',
        }),
      }, 'shortlist-ai-fit', { timeoutMs: 90_000 });
      if (!res.ok) {
        console.error('OpenAI error', res.status, await res.text());
        continue;
      }
      const data = await res.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) continue;
      const fits: any[] = JSON.parse(args).fits ?? [];
      const keys = new Set(batch.map((p) => p.key));
      const at = new Date().toISOString();
      for (const f of fits) {
        if (!keys.has(f.key)) continue;
        const score = Math.max(0, Math.min(100, Math.round(Number(f.score) || 0)));
        const row = {
          ai_fit_score: score,
          ai_fit_summary: clip(f.summary, 600),
          ai_fit_strengths: list(f.strengths).slice(0, 3).map((x: string) => clip(x, 80)),
          ai_fit_gaps: list(f.gaps).slice(0, 3).map((x: string) => clip(x, 80)),
          ai_fit_at: at,
          ai_fit_basis: basis,
        };
        const { error } = await admin.from('sourcing_project_candidates').update(row).eq('id', f.key);
        if (error) { console.error('Saving AI fit failed:', error.message); continue; }
        scored++;
        results.push({ id: f.key, ...row });
      }
    }

    const remaining = Math.max(0, (rows ?? []).filter((r: any) => force || !r.ai_fit_at || r.ai_fit_basis !== basis).length - todo.length);
    return json({ scored, remaining, basis, results }, 200, cors);
  } catch (error) {
    console.error('shortlist-ai-fit error:', error);
    return json({ error: "Couldn't score the shortlist right now. Try again in a moment." }, 500, cors);
  }
});
