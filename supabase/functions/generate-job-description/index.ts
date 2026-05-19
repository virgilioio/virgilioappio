import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeadersFor, handlePreflight } from "../_shared/mod.ts";

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
  organization_id?: string;
  primary_location?: string;
  additional_locations?: string[];
  locations?: string[];
  skills?: string[];
  seniority?: string;
  experience_min?: number;
  experience_max?: number;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  include_signing_bonus?: boolean;
  status?: string;
  [key: string]: unknown;
}

function buildContextBlock(jobData: JobDataInput): string {
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

  push("Job title", jobData.title);
  push("Internal title", jobData.internal_title);
  push("Job level", jobData.job_level);
  push("Seniority", jobData.seniority);
  push("Employment type", jobData.employment_type);
  push("Work mode", jobData.work_mode);
  push("Department", jobData.department);
  push("Primary location", jobData.primary_location);
  push("Additional locations", jobData.additional_locations || jobData.locations);
  push("Required skills", jobData.skills);
  if (jobData.experience_min || jobData.experience_max) {
    const min = jobData.experience_min ?? "?";
    const max = jobData.experience_max ?? "?";
    lines.push(`- Experience: ${min}–${max} years`);
  }
  if (jobData.salary_min || jobData.salary_max) {
    const cur = jobData.salary_currency || "";
    lines.push(
      `- Salary range: ${cur} ${jobData.salary_min ?? "?"} – ${jobData.salary_max ?? "?"}`
    );
  }
  if (jobData.include_signing_bonus) lines.push(`- Includes signing bonus`);

  return lines.join("\n");
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

    const title = (jobData.title ?? "").toString().trim();
    const level = (jobData.job_level ?? "").toString().trim();
    if (!title || !level) {
      return json(
        {
          error: "insufficient_context",
          message:
            "Add at least a job title and job level so Gio can draft a description.",
        },
        400
      );
    }

    const context = buildContextBlock(jobData);

    const systemPrompt = `You are a senior recruiting writer drafting job descriptions for a modern hiring platform.

Rules:
- Output MARKDOWN ONLY. No preamble, no closing remarks, no code fences.
- Use these sections in order: "## About the role", "## What you'll do", "## What we're looking for", "## Nice to have" (optional), "## What we offer" (only if salary/bonus/work-mode info is provided).
- Use concise bullet points (4–7 per list section). No fluff, no clichés ("rockstar", "ninja", "fast-paced environment").
- Tone: warm, professional, inclusive. Avoid gendered language.
- Match the language of the job title. If the title is in English, write in English. If clearly Portuguese/Spanish/French/Italian, write in that language.
- Do NOT invent a company name, perks, or compensation that wasn't provided.
- Reflect work mode, location, employment type, and seniority naturally in the copy.
- Keep total length between 250 and 450 words.`;

    const userPrompt = `Draft a job description based on the following structured inputs. Synthesize naturally — do not just list the fields back.

${context}`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
        return json({ error: "credits_exhausted", message: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }, 402);
      }
      return json({ error: "ai_error", message: "Failed to generate description." }, 502);
    }

    const data = await aiRes.json();
    const description: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!description) {
      return json({ error: "empty_response" }, 502);
    }

    return json({ description });
  } catch (err) {
    console.error("generate-job-description error", err);
    return json({ error: "internal_error", message: (err as Error).message }, 500);
  }
});
