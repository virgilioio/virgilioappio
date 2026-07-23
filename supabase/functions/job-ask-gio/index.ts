// job-ask-gio — job-scoped Q&A used by the "Ask Gio" box on Job Dashboard.
//
// Contract:
//   POST { jobId, jobTitle?, question, history?: {role, content}[] }
//   →    { answer: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handlePreflight, corsHeadersFor } from '../_shared/cors.ts';

const MODEL = 'google/gemini-2.5-flash';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type Msg = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const cors = corsHeadersFor(req.headers.get('origin') ?? undefined);

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const auth = req.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      auth.replace('Bearer ', ''),
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body?.jobId;
    const question: string = String(body?.question ?? '').trim();
    const historyRaw: Msg[] = Array.isArray(body?.history) ? body.history : [];
    if (!jobId || !question) {
      return new Response(JSON.stringify({ error: 'jobId and question are required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Compact job context — RLS scoped to caller.
    const { data: job } = await supabase
      .from('jobs')
      .select(
        'id, title, department, location, work_mode, employment_type, status, job_level, salary_min, salary_max, currency, min_years_experience, max_years_experience, skills, standardized_skills, target_fill_date, created_at',
      )
      .eq('id', jobId)
      .maybeSingle();

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Stage & pipeline counts.
    const [{ data: stages }, { data: apps }] = await Promise.all([
      supabase
        .from('job_stages')
        .select('id, name, position, is_required')
        .eq('job_id', jobId)
        .order('position', { ascending: true }),
      supabase
        .from('candidate_job_associations')
        .select('id, current_stage_id, status, created_at, updated_at')
        .eq('job_id', jobId)
        .is('deleted_at', null)
        .limit(1000),
    ]);

    const stageList = stages ?? [];
    const appList = apps ?? [];
    const stageCount: Record<string, number> = {};
    for (const a of appList) {
      const key = a.current_stage_id ?? 'unknown';
      stageCount[key] = (stageCount[key] ?? 0) + 1;
    }
    const statusCount: Record<string, number> = {};
    for (const a of appList) {
      const k = a.status ?? 'unknown';
      statusCount[k] = (statusCount[k] ?? 0) + 1;
    }

    const contextLines: string[] = [
      `Job: ${job.title}${job.department ? ' · ' + job.department : ''}`,
      job.location ? `Location: ${job.location}${job.work_mode ? ' (' + job.work_mode + ')' : ''}` : '',
      job.status ? `Status: ${job.status}` : '',
      job.employment_type ? `Employment: ${job.employment_type}` : '',
      job.job_level ? `Level: ${job.job_level}` : '',
      job.salary_min || job.salary_max
        ? `Salary: ${job.salary_min ?? '?'}–${job.salary_max ?? '?'} ${job.currency ?? ''}`.trim()
        : '',
      job.min_years_experience != null || job.max_years_experience != null
        ? `Experience: ${job.min_years_experience ?? 0}–${job.max_years_experience ?? '?'} yrs`
        : '',
      (job.standardized_skills?.length || job.skills?.length)
        ? `Skills: ${(job.standardized_skills ?? job.skills ?? []).slice(0, 15).join(', ')}`
        : '',
      job.target_fill_date ? `Target fill: ${job.target_fill_date}` : '',
      `Total applications: ${appList.length}`,
      `Status breakdown: ${
        Object.entries(statusCount)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ') || 'none'
      }`,
      stageList.length
        ? `Stages (name · count): ${stageList
            .map((s) => `${s.name}=${stageCount[s.id] ?? 0}`)
            .join(' · ')}`
        : '',
    ].filter(Boolean);

    const contextBlock = contextLines.join('\n');

    // Build messages: keep last 8 turns of prior history.
    const history: Msg[] = historyRaw
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-8);

    const messages = [
      {
        role: 'system' as const,
        content: [
          'You are Gio, a concise hiring copilot.',
          'Answer the recruiter\u2019s question about THIS job using ONLY the provided context.',
          'If the context is insufficient, say so briefly and suggest what data would help.',
          'Be terse. Prefer short paragraphs and light markdown (bold, bullet lists).',
          'Never invent candidate names, sources, or numbers not present in the context.',
          '',
          'JOB CONTEXT:',
          contextBlock,
        ].join('\n'),
      },
      ...history,
      { role: 'user' as const, content: question },
    ];

    const gwRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': LOVABLE_API_KEY,
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!gwRes.ok) {
      const text = await gwRes.text().catch(() => '');
      const status = gwRes.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit reached. Please try again in a moment.' }),
          { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({
            error: 'AI credits exhausted. Add credits in Workspace billing to continue.',
          }),
          { status: 402, headers: { ...cors, 'Content-Type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI gateway error (${status}): ${text.slice(0, 300)}` }),
        { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } },
      );
    }

    const gwJson = await gwRes.json();
    const answer: string =
      gwJson?.choices?.[0]?.message?.content?.toString().trim() ?? '';
    if (!answer) {
      return new Response(JSON.stringify({ error: 'Empty response from AI.' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[job-ask-gio] error', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
