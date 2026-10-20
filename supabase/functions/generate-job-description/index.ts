import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";
import { jobFileSources, sourcesBlock } from "../_shared/jobSources.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface JobDataInput {
  title?: string;
  internal_title?: string;
  job_level?: string;
  work_mode?: string;
  employment_type?: string;
  department?: string;
  department_id?: string;
  organization_id?: string;
  primary_location?: string;
  location?: string;
  additional_locations?: string[];
  locations?: string[];
  skills?: string[];
  skill_priorities?: Record<string, string>;
  seniority?: string;
  experience_min?: number;
  experience_max?: number;
  min_years_experience?: number;
  max_years_experience?: number;
  description?: string;
  [key: string]: unknown;
}

interface Client {
  name: string;
  description: string | null;
  industry: string | null;
  website: string | null;
}

function buildContextBlock(jobData: JobDataInput, department: string | null, client: Client | null): string {
  const lines: string[] = [];
  const push = (label: string, val: unknown) => {
    if (val === undefined || val === null) return;
    if (Array.isArray(val)) {
      if (val.length === 0) return;
      lines.push(`- ${label}: ${val.join(", ")}`);
    } else if (typeof val === "string") {
      if (val.trim() === "") return;
      lines.push(`- ${label}: ${val}`);
    } else {
      lines.push(`- ${label}: ${val}`);
    }
  };

  if (client) {
    push("Client (the company hiring)", client.name);
    push("Client industry", client.industry);
    push("Client website", client.website);
    push("Client description", client.description);
  }
  push("Job title", jobData.title);
  push("Job level", jobData.job_level);
  push("Seniority", jobData.seniority);
  push("Employment type", jobData.employment_type);
  push("Work mode", jobData.work_mode);
  push("Department", department ?? jobData.department);
  push("Primary location", jobData.primary_location ?? jobData.location);
  push("Additional locations", jobData.additional_locations || jobData.locations);
  // Skills by priority, as Gio Fit scores them.
  const pr = jobData.skill_priorities ?? {};
  const skills = jobData.skills ?? [];
  const tier = (t: string) => skills.filter((s) => (pr[s] ?? "nice") === t);
  push("Must-have skills", tier("must"));
  push("Nice-to-have skills", tier("nice"));
  push("Extra-points skills", tier("bonus"));
  const min = jobData.experience_min ?? jobData.min_years_experience;
  const max = jobData.experience_max ?? jobData.max_years_experience;
  if (min || max) lines.push(`- Experience: ${min ?? "?"}-${max ?? "?"} years`);

  const notes = typeof jobData.description === "string" ? jobData.description.trim() : "";
  let block = lines.join("\n");
  if (notes) {
    block += `\n\n## Author notes / rough draft (from the recruiter)\n${notes}`;
  }
  return block;
}

serve(async (req) => {
  const pre = handlePreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("Origin") ?? req.headers.get("origin") ?? undefined;
  const cors = corsHeadersFor(origin);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI service not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const { data: member } = await supabase
      .from("members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("user_status", "active")
      .maybeSingle();
    if (!member) return json({ error: "Membership not found" }, 403);

    const body = await req.json().catch(() => ({}));
    const jobData: JobDataInput = body?.jobData ?? {};
    const jobId: string | null = typeof body?.jobId === "string" ? body.jobId : null;

    const title = (jobData.title ?? "").toString().trim();
    if (!title) {
      return json(
        {
          error: "insufficient_context",
          message:
            "Add at least a job title so Gio can draft a description.",
        },
        400
      );
    }

    // The client and the department, read only inside the caller's workspace.
    let client: Client | null = null;
    if (jobData.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, description, industry, website, tenant_id")
        .eq("id", jobData.organization_id)
        .maybeSingle();
      if (org && org.tenant_id === member.tenant_id) {
        client = { name: org.name, description: org.description, industry: org.industry, website: org.website };
      }
    }
    let department: string | null = null;
    if (jobData.department_id) {
      const { data: dep } = await supabase
        .from("departments")
        .select("name, tenant_id")
        .eq("id", jobData.department_id)
        .maybeSingle();
      if (dep && (!dep.tenant_id || dep.tenant_id === member.tenant_id)) department = dep.name;
    }

    const sources = jobId ? await jobFileSources(supabase, jobId, member.tenant_id) : [];
    const context = buildContextBlock(jobData, department, client);
    const clientName = client?.name ?? "the client";

    const systemPrompt = `You are a senior recruiting writer drafting job descriptions for a recruitment agency that hires on behalf of its clients.

Structure (always, in this order, nothing else):
1. "## About ${clientName}": who the client is and what they do.
2. "## About the job": the role's purpose, scope, team and context.
3. "## What you'll do": 5-7 bullets of concrete responsibilities.
4. "## What we're looking for": 5-8 bullets. Requirements first; then the nice-to-haves, each one saying so ("A plus:", "Nice to have:"). When a document sets tiers (Must have / Nice to have), keep them exactly: a nice-to-have never reads as a requirement. When a document describes the person the client pictures (e.g. "an educator who became client-facing"), open this section with one sentence saying so.
5. "## Why join ${clientName}": 3-5 bullets on mission, impact, growth, team and ways of working.

Rules:
- Output MARKDOWN ONLY. No preamble, no closing remarks, no code fences, no title line.
- Never include an offer, compensation, salary, pay, bonus, equity or benefits section, and never state pay figures anywhere. The offer is handled elsewhere.
- Use the client's real name in the two client headings. The company described is the client, never the recruitment agency.
- Facts come only from the inputs, the recruiter's notes and the source documents, stated as the documents state them: keep dates, names and roles exact (a backer is not "led by", "September 2025" is not "late 2025"). Do not invent the client's history, size, funding, customers or perks.
- Never repeat internal material from the documents: fees, pricing, client contacts, benchmark or named candidates, internal owners, deadlines, other searches, or the recruiter's salary advice.
- Traits a document asks for (charisma, independence, ambition) are written in plain professional terms ("presence and credibility with academics", "comfortable working on your own across time zones"), never as "strong charisma".
- When little is known about the client, keep "About" and "Why join" short and grounded in what is known (industry, the role's impact, how the team works).
- When source documents are given (intake notes, client briefs, earlier job descriptions), treat them as the main source of truth: keep their facts, tools, responsibilities and requirements. Rewrite rather than copy.
- If an "Author notes / rough draft" section is given, keep the recruiter's intent and specifics, and polish and expand rather than discard.
- Tone: warm, professional, inclusive. Concise bullets, no cliches ("rockstar", "ninja", "fast-paced environment"). Avoid gendered language.
- Match the language of the job title. If you write in another language, translate the five headings faithfully and keep the same order.
- Reflect work mode, location, employment type and seniority naturally.
- Keep the total between 350 and 600 words.`;

    const userPrompt = `Draft the job description from these inputs. Synthesize naturally; do not just list the fields back.

${context}${sourcesBlock(sources)}`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429) {
        return json({ error: "rate_limited", message: "Too many requests. Try again in a moment." }, 429);
      }
      if (aiRes.status === 402) {
        return json({ error: "credits_exhausted", message: "AI credits exhausted. Add credits in Settings > Workspace > Usage." }, 402);
      }
      return json({ error: "ai_error", message: "Failed to generate description." }, 502);
    }

    const data = await aiRes.json();
    const description: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!description) {
      return json({ error: "empty_response" }, 502);
    }

    return json({ description, sources_used: sources.map((s) => s.name) });
  } catch (err) {
    console.error("generate-job-description error", err);
    return json({ error: "internal_error", message: "Failed to generate description." }, 500);
  }
});
