// "Generate with Gio" for a job's skills (Allan, 2026-10-20): proposes the skills
// Gio Fit scores candidates against, in three tiers, from the job details, its
// description and its uploaded files.
//
// A skill is a CV signal: the work the role does, its domain, tools and
// certifications, worded the way CVs word them. Traits (charisma, independence),
// location, years and contract type are never skills: a CV can't prove a trait,
// and the others are scored in their own Gio Fit dimensions. They come back in
// left_out so the recruiter sees what was set aside, and the years in experience.
//
// Tiers: about 3-4 must-have, 5 nice-to-have and 3 extra-points skills (ranges
// 2-5, 4-6 and 2-4). Each unmet must-have caps a candidate's score
// (analyze-candidate-fit), so the must list holds only what a CV has to show.
// The model proposes; balance() (_shared/skillBalance.ts) enforces the rest.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";
import { jobFileSources, sourcesBlock } from "../_shared/jobSources.ts";
import { balance, type Tier, yearsRange } from "../_shared/skillBalance.ts";

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
        ? `- Skills already listed: ${current
          .map((s) => `${s} [${pr[s] === "must" ? "must" : pr[s] === "bonus" ? "extra" : "nice"}]`)
          .join(", ")}`
        : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You define the skills a recruiter's AI scores candidates' CVs against for one job. A recruiter reads the score as the signal to talk to someone or not, so every skill must be something a CV or LinkedIn profile can show.

Return JSON only:
{"must": [...], "nice": [...], "extra": [...], "min_years": n|null, "max_years": n|null, "left_out": [...]}

What a skill is:
- Start from what the role truly does day to day, for its title, seniority and industry. A Customer Success Manager runs client onboarding, adoption, renewals, account management and client-facing work; an SDR does outbound prospecting and cold calling; a payroll lead runs payroll and compliance. Then add the domain, industry, tools, certifications and languages the description and documents ask for.
- Word each one the way people write it on a CV ("Client Onboarding", "Account Management", "Renewals", "Higher Education", "Salesforce", "English (C1)"). 1-4 words, Title Case unless a product name. One idea per skill: put alternatives in one skill with "or" ("Canvas or Moodle") rather than splitting them.

Never a skill, even when a document lists it:
- Soft skills and traits: charisma, credibility, communication, independence, self-starter, proactive, ambition, leadership as a trait, problem solving. A CV can't prove them; they belong in the interview.
- Location, time zone, years of experience, contract type, availability, salary. Gio scores those separately.
Put every requirement you leave out for these reasons in "left_out" as a short label (e.g. "Charisma with academics", "Works independently", "Based in Toronto", "Freelance contract").

Tiers:
- "must": only what a CV has to show for the person to be worth a call. Usually 3-4 (2 for junior roles, 5 at most). Each missing must-have caps the score, so when in doubt it is "nice". The role's core function belongs here even when a document says the job title itself is only nice-to-have: the title is a label, the function is the work (e.g. "Client-facing Account Management" is a must for a CSM even if "a CSM title" is nice).
- "nice": skills that clearly help and count in the skills match. Aim for 5 (4-6).
- "extra": differentiators that lift a score when present and are never held against anyone. Aim for 3 (2-4).
- When a document sets its own tiers (a Must have / Nice to have table), keep them: a nice-to-have never becomes a must-have. Its red flags ("no client contact", "no teaching exposure") point to what the must-haves should prove.

Also:
- "min_years" / "max_years": the years of experience the description or documents state, as whole numbers, else null.
- No duplicates or near-duplicates across tiers. Prefer the job's own wording.
- Base everything on the description and the documents when given; never invent requirements they contradict. If skills are already listed, keep the relevant ones in their tier unless clearly wrong.`;

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
    const { leftOut, ...skills } = balance(parsed as Partial<Record<Tier | "left_out", unknown>>);
    if (!skills.must.length && !skills.nice.length) {
      return json({ error: "empty_response", message: "Gio couldn't suggest skills. Try again." }, 502);
    }
    return json({
      skills,
      experience: yearsRange(parsed.min_years, parsed.max_years),
      left_out: leftOut,
      sources_used: sources.map((s) => s.name),
    });
  } catch (err) {
    console.error("generate-job-skills error", err);
    return json({ error: "internal_error", message: "Gio couldn't suggest skills. Try again." }, 500);
  }
});
