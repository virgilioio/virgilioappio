import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.1";
import { AI_MODELS } from '../_shared/aiModels.ts';
import { accessDenied, checkRecordAccess } from '../_shared/recordAccess.ts';
import { cleanPost, plainDescription, postingFacts, sharePostsPrompt, type ShareVoice } from '../_shared/sharePosts.ts';

/**
 * The share kit's posts (job exposure, Phase 1; Allan, Go! 2026-11-12): a LinkedIn post
 * and a WhatsApp message about a job's live post, in its language, as our team or as
 * the hiring company. Anyone who can open the job may ask. Pay only when the post shows it.
 * The texts hold {link}; the browser puts each channel's tagged link there.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const input = await req.json().catch(() => ({})) as { job_id?: string; voice?: string };
    const jobId = typeof input.job_id === 'string' ? input.job_id : '';
    const voice: ShareVoice = input.voice === 'client' ? 'client' : 'team';
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "Pick a job to share." }, 400);

    const access = await checkRecordAccess(req, admin, { jobId }, { requireRefs: true });
    if (!access.ok) return accessDenied(access, corsHeaders);

    const { data: job } = await admin
      .from('jobs')
      .select('id, title, status, location, work_mode, salary_min, salary_max, currency, show_salary_public')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return json({ error: "This job isn't there any more." }, 404);

    const { data: postings } = await admin
      .from('job_postings')
      .select('id, title, description, details, tenant_id, is_active, updated_at')
      .eq('job_id', jobId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1);
    const posting = postings?.[0];
    if (!posting || job.status !== 'open') {
      return json({ error: "This job has no live job post to share.", code: 'no_live_post' }, 409);
    }

    const { data: tenantRows } = await admin.rpc('get_public_tenant_info', { p_tenant_id: posting.tenant_id });
    const tenant = Array.isArray(tenantRows) ? tenantRows[0] : null;
    const facts = postingFacts(posting.details as Record<string, unknown> | null, job);
    const description = plainDescription(posting.description);
    if (description.length < 30) {
      return json({ error: "The job post needs a description before Gio can write about it.", code: 'no_description' }, 409);
    }

    const { system, user } = sharePostsPrompt(
      {
        title: posting.title || job.title,
        company: tenant?.name || 'the company',
        location: facts.location,
        workMode: facts.workMode,
        employmentType: facts.employmentType,
        pay: facts.pay,
        description,
      },
      voice,
    );

    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });
    const completion = await openai.chat.completions.create({
      model: AI_MODELS.reasoning,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      reasoning_effort: "low",
      max_completion_tokens: 3000,
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("No answer");
    const result = JSON.parse(content);
    const linkedin = cleanPost(result.linkedin, 'linkedin');
    const whatsapp = cleanPost(result.whatsapp, 'whatsapp');
    if (linkedin.length < 40 || whatsapp.length < 20) throw new Error("Answer too short");
    const language = typeof result.language === 'string' && /^[a-z]{2}$/i.test(result.language) ? result.language.toLowerCase() : null;
    return json({ linkedin, whatsapp, language, voice });
  } catch (err) {
    console.error('[generate-share-posts]', err instanceof Error ? err.message : err);
    return json({ error: "Gio couldn't write the posts." }, 500);
  }
});
