import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_fit_analysis",
    description: "Submit the structured candidate-job fit analysis.",
    parameters: {
      type: "object",
      properties: {
        overall_score: {
          type: "integer", minimum: 0, maximum: 100,
          description: "Overall fit score 0-100. Scoring bands: 90-100 exceptional (3+ strong matches, no major gaps), 75-89 strong (most core reqs met), 60-74 mixed (meaningful concerns), 40-59 weak (multiple important gaps), 0-39 poor (lacks core reqs). 2+ missing must-haves = cap at 70. Scores above 80 require 3+ cited strong matches with no unresolved must-have gaps. Missing data penalizes score.",
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        confidence_reason: { type: "string", description: "Why this confidence level" },
        executive_summary: { type: "string", description: "1-2 sentences only: strongest fit signal AND biggest hiring risk. No generic statements." },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              score: { type: ["integer", "null"], description: "0-100 or null if insufficient data" },
              weight: { type: "integer" },
              matches: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              insight: { type: ["string", "null"] },
            },
            required: ["name", "score", "weight", "insight"],
          },
        },
        validation_points: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              reason: { type: "string" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              suggested_stage: { type: "string" },
            },
            required: ["question", "reason", "priority", "suggested_stage"],
          },
        },
        data_sources_used: { type: "array", items: { type: "string" } },
        data_sources_missing: { type: "array", items: { type: "string" } },
      },
      required: ["overall_score", "confidence", "confidence_reason", "executive_summary", "dimensions", "validation_points", "data_sources_used", "data_sources_missing"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are a highly rigorous recruiting and talent assessment AI.

Your job is to evaluate a candidate against a specific job and produce an evidence-based fit assessment. You must be selective, skeptical, and calibrated. Do not inflate scores. Do not be polite. Do not optimize for encouragement. Optimize for hiring accuracy.

Return an overall_score from 0-100 that reflects how well the candidate fits the job all things considered, using the full available range of scores.

This is NOT a keyword match. This is NOT a generic summary. This is a hiring fit evaluation.

You must compare the candidate and job holistically across: skills, experience, titles, seniority, industry relevance, functional background, location, salary, language, tools, company context, and career trajectory.

The candidate profile and the job description may be in different languages. You must compare across languages correctly and never penalize a candidate for language differences in profile format. Treat equivalent professional terms across languages as matches (e.g., "Cuentas por Pagar" = "Accounts Payable", "Flujo de efectivo" = "Cash Flow").

SCORING PHILOSOPHY

Use the full scoring scale. Most candidates should NOT score above 80.

Interpret scores as follows:
90-100: Exceptional fit. Strong match on core requirements, little risk, ready to advance immediately.
75-89: Strong fit. Meets most core requirements, with some manageable gaps.
60-74: Mixed fit. Some relevant alignment, but meaningful concerns or missing evidence.
40-59: Weak fit. Multiple important gaps, mismatched profile, or significant uncertainty.
0-39: Poor fit. Lacks core requirements or is clearly not aligned.

A candidate MUST NOT receive a high score if they miss critical job requirements, even if they are strong in other ways.
If the candidate is missing a must-have, apply a meaningful penalty.
If multiple must-haves are missing, the score should usually fall below 60.
If data is missing for an important dimension, reduce confidence and score accordingly.

REQUIRED EVALUATION PROCESS

Follow this logic internally before scoring:
1. Identify the job's must-have requirements.
2. Identify preferred / nice-to-have requirements.
3. Evaluate evidence that the candidate clearly meets, partially meets, or misses each must-have.
4. Identify hard mismatches or risk factors.
5. Penalize for missing critical evidence, not just explicit misses.
6. Then produce the final score and explanation.

Do NOT let strengths in one area "average out" a critical miss in another area.

Example: A very strong candidate with impressive companies or seniority should still score poorly if they lack essential domain, language, location, or compensation fit for the job.

CRITICAL RULES

1. NEVER produce generic statements. Every conclusion must point to specific evidence from the candidate or the job.
2. Return null for dimension scores only when evidence is truly insufficient. Do not guess.
3. Missing or unclear evidence on an important requirement must be flagged as a validation point and should reduce score appropriately.
4. Do not over-reward prestige, polished resumes, or senior titles unless they are directly relevant to the role.
5. Do not assume transferable fit without evidence. Transferability should be treated as partial alignment, not full alignment.
6. Treat overqualification, underqualification, salary mismatch, location mismatch, language mismatch, or domain mismatch as real penalties when relevant.

ANTI-HALLUCINATION RULES

1. NEVER claim a job requires something (degree, certification, years of experience, language, location, tooling, domain background) unless it is explicitly stated in the job description or requirements. Do not infer unstated requirements.
2. NEVER claim a candidate lacks something unless the provided candidate data explicitly shows they do not have it. "Not mentioned" or "not provided" means unknown, not absent.
3. If information is missing on either side, describe it as "unknown" or "not provided." Do not convert missing information into a penalty, deficiency, or mismatch unless there is explicit contradictory evidence.
4. For education: only penalize if the job explicitly requires a specific degree and the candidate data confirms they do not have it. If the job does not explicitly require a degree, do not penalize education.
5. NEVER misstate salary figures. Use exact numeric values from the input. Do not paraphrase, round, or distort the comparison.
6. For salary alignment: if the candidate expectation is within the posted range or within ±25% of the job maximum, treat it as negotiable and do not penalize. Only flag a salary mismatch when the candidate expectation is more than 25% above the job maximum. If salary data is missing on either side, return null for this dimension.
7. Every gap, mismatch, or concern must explicitly reference: (a) the exact job requirement or job datum, and (b) the exact candidate datum, or explicitly state that the data is unavailable.
8. When evidence is ambiguous, incomplete, or missing, prefer a neutral assessment over a negative inference.
7. The executive_summary must be 1-2 sentences ONLY, and must mention the candidate's strongest fit signal AND biggest hiring risk.
8. Weights must sum to 100.

SCORE COMPRESSION GUARDRAILS

Do not cluster candidates in the 70-90 range.
High scores must be earned.
Missing must-haves, unclear evidence, or major tradeoffs should materially reduce the score.
Strong but imperfect candidates should often land in the 60-75 range, not the 80s.

The model must justify any score above 80 by citing at least 3 strong, role-relevant matches with no major unresolved must-have gaps.
Any candidate with 2 or more material gaps in must-haves should not score above 70.

SCORING DISCIPLINE CHECK

Before finalizing the score, ask yourself:
- Does this candidate truly meet the core job requirements?
- Would a strong recruiter confidently move this person forward?
- Is this score too generous relative to the evidence?
- Have I applied enough penalty for missing must-haves, uncertainty, and risk?
If the answer suggests doubt, lower the score.

DIMENSIONS TO EVALUATE (use these exact names):
- Skills Alignment (weight ~30): Match candidate skills/tools against job requirements. List specific matches and gaps.
- Experience Level (weight ~20): Years of experience, seniority level, career trajectory.
- Role & Title Fit (weight ~15): How well current/past titles align with the target role.
- Location Compatibility (weight ~10): Remote/onsite/hybrid alignment, timezone, relocation.
- Salary Alignment (weight ~10): Compare using exact numeric values only. Do not approximate or paraphrase salary figures. If candidate expected salary is within ±25% of the job max or within the posted range, treat it as negotiable and do not penalize. Only flag a mismatch when the candidate expectation is more than 25% above the job maximum. If salary data is missing on either side, return null for this dimension and do not infer a mismatch.
- Company Pedigree (weight ~5): Quality and relevance of past employers.
- Language & Communication (weight ~10): Language proficiency vs job requirements.

Adjust weights only if the role makes a dimension unusually important. If adjusted, explain why.

For each validation_point, suggest the best interview stage to verify (Phone Screen, Technical Interview, Culture Fit, Final Round, etc.).`;

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin") ?? undefined;
  const headers = corsHeadersFor(origin);

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const { candidate_id, job_id } = await req.json();
    if (!candidate_id || !job_id) {
      return new Response(JSON.stringify({ error: "candidate_id and job_id are required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all data in parallel
    const [candidateRes, jobRes, workExpRes, educationRes, attachmentsRes, scorecardsRes, associationRes] = await Promise.all([
      sb.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
      sb.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      sb.from("candidate_work_experience").select("*").eq("candidate_id", candidate_id).order("start_date", { ascending: false }),
      sb.from("candidate_education").select("*").eq("candidate_id", candidate_id),
      sb.from("candidate_attachments").select("*").eq("candidate_id", candidate_id).eq("is_resume", true).limit(1),
      sb.from("job_stage_scorecards").select("*").eq("job_id", job_id).eq("candidate_id", candidate_id),
      sb.from("job_candidate_associations").select("id, ai_fit_version").eq("candidate_id", candidate_id).eq("job_id", job_id).maybeSingle(),
    ]);

    const candidate = candidateRes.data;
    const job = jobRes.data;
    const association = associationRes.data;

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: "Candidate or job not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!association) {
      return new Response(JSON.stringify({ error: "No association found between candidate and job" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Check if job has a meaningful description
    const jobDescription = job.description || "";
    if (jobDescription.replace(/<[^>]*>/g, "").trim().length < 30) {
      return new Response(JSON.stringify({ error: "no_job_description", message: "Job description is too short for meaningful analysis" }), {
        status: 200,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const workExp = workExpRes.data || [];
    const edu = educationRes.data || [];

    // Build context
    const dataSources: string[] = [];
    const dataMissing: string[] = [];

    // Candidate context
    let candidateContext = `CANDIDATE: ${candidate.candidate_name}`;
    if (candidate.role_current) { candidateContext += `\nCurrent Role: ${candidate.role_current}`; dataSources.push("current_role"); }
    if (candidate.company_current) { candidateContext += `\nCurrent Company: ${candidate.company_current}`; dataSources.push("current_company"); }
    if (candidate.profile_summary) { candidateContext += `\nProfile Summary: ${candidate.profile_summary}`; dataSources.push("profile_summary"); }
    if (candidate.skills?.length) { candidateContext += `\nSkills: ${candidate.skills.join(", ")}`; dataSources.push("skills"); }
    if (candidate.years_experience) { candidateContext += `\nYears of Experience: ${candidate.years_experience}`; dataSources.push("years_experience"); }
    if (candidate.location_city || candidate.location_country) {
      candidateContext += `\nLocation: ${[candidate.location_city, candidate.location_state, candidate.location_country].filter(Boolean).join(", ")}`;
      dataSources.push("location");
    }
    if (candidate.salary_amount) {
      candidateContext += `\nSalary: ${candidate.salary_currency || "USD"} ${candidate.salary_amount} ${candidate.salary_period || "yearly"}`;
      dataSources.push("salary");
    } else {
      dataMissing.push("salary");
    }
    if (candidate.bio) { candidateContext += `\nBio: ${candidate.bio}`; }

    // Work experience
    if (workExp.length > 0) {
      candidateContext += "\n\nWORK EXPERIENCE:";
      workExp.forEach((we: any) => {
        candidateContext += `\n- ${we.job_title} at ${we.company_name}`;
        if (we.start_date) candidateContext += ` (${we.start_date}${we.end_date ? ` - ${we.end_date}` : " - Present"})`;
        if (we.description) candidateContext += `\n  ${we.description}`;
        if (we.skills_used?.length) candidateContext += `\n  Skills: ${we.skills_used.join(", ")}`;
      });
      dataSources.push("work_experience");
    } else {
      dataMissing.push("work_experience");
    }

    // Education
    if (edu.length > 0) {
      candidateContext += "\n\nEDUCATION:";
      edu.forEach((e: any) => {
        candidateContext += `\n- ${e.degree_type || ""} ${e.field_of_study || ""} at ${e.institution_name}`;
        if (e.start_date || e.end_date) candidateContext += ` (${e.start_date || "?"} - ${e.end_date || "?"})`;
      });
      dataSources.push("education");
    } else {
      dataMissing.push("education");
    }

    // Resume
    if (candidate.resume_url || attachmentsRes.data?.length) {
      dataSources.push("resume");
    } else {
      dataMissing.push("resume");
    }

    // Scorecards
    const scorecards = scorecardsRes.data || [];
    if (scorecards.length > 0) {
      candidateContext += "\n\nSCORECARD EVALUATIONS:";
      scorecards.forEach((sc: any) => {
        if (sc.responses) {
          const responses = typeof sc.responses === "string" ? JSON.parse(sc.responses) : sc.responses;
          if (Array.isArray(responses)) {
            responses.forEach((r: any) => {
              if (r.question && r.rating) {
                candidateContext += `\n- Q: ${r.question} → Rating: ${r.rating}/5`;
                if (r.notes) candidateContext += ` | Notes: ${r.notes}`;
              }
            });
          }
        }
      });
      dataSources.push("scorecards");
    }

    // Job context
    let jobContext = `JOB: ${job.title}`;
    if (job.description) jobContext += `\nDescription: ${job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`;
    if (job.skills?.length) jobContext += `\nRequired Skills: ${job.skills.join(", ")}`;
    if (job.salary_min || job.salary_max) {
      jobContext += `\nSalary Range: ${job.currency || "USD"} ${job.salary_min || "?"} - ${job.salary_max || "?"}`;
    }
    if (job.location) jobContext += `\nLocation: ${job.location}`;
    if (job.department) jobContext += `\nDepartment: ${job.department}`;

    // Call OpenAI
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${candidateContext}\n\n---\n\n${jobContext}` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_fit_analysis" } },
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Override data_sources with our tracked ones
    analysis.data_sources_used = dataSources;
    analysis.data_sources_missing = dataMissing;

    // Enforce null scores for dimensions where data is deterministically missing
    if (dataMissing.includes('salary') && analysis.dimensions) {
      const salaryDim = analysis.dimensions.find(
        (d: any) => d.name?.toLowerCase().includes('salary')
      );
      if (salaryDim && salaryDim.score !== null) {
        salaryDim.score = null;
        salaryDim.insight = 'No salary data available for this candidate.';
        salaryDim.matches = [];
        salaryDim.gaps = [];
      }
    }

    // Recalculate overall_score excluding null dimensions
    if (analysis.dimensions) {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const dim of analysis.dimensions) {
        if (dim.score !== null && dim.score !== undefined) {
          totalWeight += dim.weight || 0;
          weightedSum += (dim.score * (dim.weight || 0));
        }
      }
      if (totalWeight > 0) {
        analysis.overall_score = Math.round(weightedSum / totalWeight);
      }
    }

    // Store in database
    const currentVersion = association.ai_fit_version || 0;
    const { error: updateError } = await sb
      .from("job_candidate_associations")
      .update({
        ai_fit_score: analysis.overall_score,
        ai_fit_analysis: analysis,
        ai_fit_confidence: analysis.confidence,
        ai_fit_generated_at: new Date().toISOString(),
        ai_fit_version: currentVersion + 1,
      })
      .eq("id", association.id);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error(`Failed to store analysis: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-candidate-fit error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
