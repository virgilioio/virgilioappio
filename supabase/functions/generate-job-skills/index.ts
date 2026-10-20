// "Generate with Gio" for a job's skills (Allan, 2026-10-20): proposes the skills
// Gio Fit scores candidates against, in three tiers, from the job details, its
// description and its uploaded files.
//
// Tiers and balance: about 5 must-have, 5 nice-to-have and 3 extra-points skills
// (ranges 4-6, 4-6 and 2-4; fewer musts for junior roles, more for senior ones).
// Each unmet must-have caps a candidate's score (analyze-candidate-fit), so the
// must list stays short and holds only real requirements. The model proposes;
// balance() (_shared/skillBalance.ts) enforces the ranges whatever it returns.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";
import { jobFileSources, sourcesBlock } from "../_shared/jobSources.ts";
import { balance, type Tier } from "../_shared/skillBalance.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function parseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? undefined;
  const cors = corsHeadersFor(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    if (!LOVABLE_API_KEY) return json({ error: "AI service not configured" }, 500);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Unauthorized" }, 401);
    const { data: member } = await supabase
      .from("members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("user_status", "active")
      .maybeSingle();
    if (!member) return json({ error: "Membership not found" }, 403);

    const body = await req.json().catch(() => ({}));
    const job = body?.jobData ?? {};
    const jobId: string | null = typeof body?.jobId === "string" ? body.jobId : null;
    const title = String(job.title ?? "").trim();
    if (!title) {
      return json({ error: "insufficient_context", message: "Add a job title so Gio can suggest skills." }, 400);
    }

    const sources = jobId ? await jobFileSources(supabase, jobId, member.tenant_id) : [];
    const description = String(job.description ?? "").trim().slice(0, 12000);
    const current: string[] = Array.isArray(job.skills) ? job.skills.filter((s: unknown) => typeof s === "string") : [];
    const pr: Record<string, string> = job.skill_priorities ?? {};
    const lines = [
      `- Job title: ${title}`,
      job.job_level ? `- Job level: ${job.job_level}` : "",
      job.employment_type ? `- Employment type: ${job.employment_type}` : "",
      job.work_mode ? `- Work mode: ${job.work_mode}` : "",
      job.min_years_experience != null || job.max_years_experience != null
        ? `- Experience: ${job.min_years_experience ?? "?"}-${job.max_years_experience ?? "?"} years`
        : "",
      current.length
        ? `- Skills the recruiter already listed (keep the relevant ones, with their tier unless clearly wrong): ${current
          .map((s) => `${s} [${pr[s] === "must" ? "must" : pr[s] === "bonus" ? "extra" : "nice"}]`)
          .join(", ")}`
        : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You define the skills a recruiter's AI scores candidates against for one job.

Return JSON only: {"must": [...], "nice": [...], "extra": [...]}

Tiers:
- "must": the real requirements. A candidate missing one is a weak fit; each missing must-have caps the score. Aim for 5 (4 for entry or junior roles, 6 for senior, lead or highly technical roles). Never more than 6.
- "nice": skills that clearly help and are scored in the skills match. Aim for 5 (4-6).
- "extra": differentiators that lift a score when present and are never held against anyone. Aim for 3 (2-4).

Rules:
- Each skill is something a CV or LinkedIn profile can show: a tool, technology, method, domain, industry, certification, language or a concrete kind of experience (e.g. "B2B SaaS sales", "Salesforce", "Cold calling", "English (C1)", "Python", "Payroll in Mexico").
- No generic soft skills ("communication", "teamwork", "proactive", "self-starter") unless the job makes one a hard requirement, and then phrase it concretely.
- 1-4 words each, Title Case unless it is a product name. Use the names people write on CVs, in English unless the job is written in another language.
- No duplicates or near-duplicates across tiers. Prefer the job's own wording.
- Base everything on the job description and the source documents when given; do not invent requirements they contradict.`;

    const userPrompt = `Job:
${lines}${description ? `\n\n## Job description\n${description}` : ""}${sourcesBlock(sources)}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      console.error("AI gateway error", aiRes.status, await aiRes.text());
      if (aiRes.status === 429) return json({ error: "rate_limited", message: "Too many requests. Try again in a moment." }, 429);
      if (aiRes.status === 402) {
        return json({ error: "credits_exhausted", message: "AI credits exhausted. Add credits in Settings > Workspace > Usage." }, 402);
      }
      return json({ error: "ai_error", message: "Gio couldn't suggest skills. Try again." }, 502);
    }
    const data = await aiRes.json();
    const parsed = parseJson(String(data?.choices?.[0]?.message?.content ?? ""));
    if (!parsed) return json({ error: "empty_response", message: "Gio couldn't suggest skills. Try again." }, 502);
    const skills = balance(parsed as Partial<Record<Tier, unknown>>);
    if (!skills.must.length && !skills.nice.length) {
      return json({ error: "empty_response", message: "Gio couldn't suggest skills. Try again." }, 502);
    }
    return json({ skills, sources_used: sources.map((s) => s.name) });
  } catch (err) {
    console.error("generate-job-skills error", err);
    return json({ error: "internal_error", message: "Gio couldn't suggest skills. Try again." }, 500);
  }
});
