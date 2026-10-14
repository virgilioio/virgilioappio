import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

import { openaiFetch, OpenAiTimeoutError } from '../_shared/openaiFetch.ts';

// Reasoning + per-skill adjudication needs far more than the shared 60s default.
const FIT_CALL_TIMEOUT_MS = 150_000;
const TRANSLATION_CALL_TIMEOUT_MS = 120_000;
import { AI_MODELS } from '../_shared/aiModels.ts';
import { accessDenied, checkRecordAccess } from '../_shared/recordAccess.ts';
import { loadResumeText } from '../_shared/resumeText.ts';
import { mergeTranslatedProse } from './language-utils.ts';
import { analyseTenure } from './tenure.ts';
import { formatMoney, loadCurrencyRates, normaliseSalary } from '../_shared/salary.ts';

// Bump when the prompt, the dimensions or the scoring rules change, so a
// stored dossier from an older recipe is re-scored even if its inputs match.
//
// v4 (2026-10-14): the model's holistic score is kept and bounded by rules
// instead of being replaced with a weighted mean; must-haves come from the
// job description, not the skills list; Tenure & Progression replaces Company
// Pedigree; years-of-experience bounds and additional locations are sent;
// unchanged inputs are not re-scored; a re-score explains what changed.
const PROMPT_VERSION = 4;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** The role inside a Supabase JWT, without verifying it (the gateway already did). */
function jwtRole(auth: string): string {
  try {
    const token = auth.replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return String(payload?.role ?? "");
  } catch {
    return "";
  }
}

const TRIGGERS = new Set(["refresh", "auto", "queue", "scorecard"]);

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English", es: "Spanish", pt: "Portuguese", fr: "French",
  de: "German", it: "Italian", nl: "Dutch", pl: "Polish",
};

const SOURCE_LABELS: Record<string, string> = {
  current_role: "Candidate profile", current_company: "Candidate profile",
  profile_summary: "Candidate profile", skills: "Candidate profile",
  years_experience: "Candidate profile", location: "Candidate profile",
  salary: "Candidate profile", salary_uncomparable: "Candidate profile",
  work_experience: "Work experience",
  education: "Education", resume: "Résumé", scorecards: "Scorecards",
};

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
          description: "Your holistic fit judgement, 0-100. Bands: 90-100 exceptional (3+ strong matches, no must-have gaps), 75-89 strong (most core requirements met), 60-74 mixed (meaningful concerns), 40-59 weak (multiple important gaps), 0-39 poor (lacks core requirements). Not a weighted average of the dimensions: a single dealbreaker (location, salary, language) or an unmet must-have pulls the score down regardless of other strengths.",
        },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        confidence_reason: { type: "string", description: "Why this confidence level" },
        profile_summary: { type: "string", description: "A concise evidence-based candidate profile summary" },
        executive_summary: { type: "string", description: "1-2 sentences only: strongest fit signal AND biggest hiring risk. No generic statements." },
        must_haves: {
          type: "array",
          description: "The requirements the job description itself states as mandatory (must, required, essential, minimum years, location, language). At most 8. Nothing inferred, and never a tool from the skills list unless the description says it is required.",
          items: {
            type: "object",
            properties: {
              requirement: { type: "string", description: "The requirement in a few words, as the job states it." },
              status: { type: "string", enum: ["met", "partial", "not_met", "unknown"], description: "met = candidate data shows it; partial = adjacent evidence; not_met = candidate data explicitly contradicts it; unknown = no data either way (never not_met without explicit evidence)." },
              evidence: { type: ["string", "null"], description: "The candidate datum relied on, or null for unknown." },
            },
            required: ["requirement", "status", "evidence"],
            additionalProperties: false,
          },
        },
        changes_since_last: {
          type: ["string", "null"],
          description: "Only when a PREVIOUS ASSESSMENT was supplied: one or two sentences naming the new evidence (a scorecard, a new résumé, changed requirements) and how it moved the score, or stating that nothing material changed. Null otherwise.",
        },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              score: { type: ["integer", "null"], description: "0-100 or null if insufficient data" },
              weight: { type: "integer" },
              verdict: { type: ["string", "null"], description: "A concise evidence-based verdict for this dimension" },
              matches: { type: "array", items: { type: "string" } },
              gaps: { type: "array", items: { type: "string" } },
              insight: { type: ["string", "null"] },
            },
            required: ["name", "score", "weight", "verdict", "insight", "matches", "gaps"],
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
        skill_evidence: {
          type: "array",
          description: "One entry per skill listed under REQUIRED SKILLS, in the same order and with the job's exact spelling. Never add, drop, merge or rename a skill.",
          items: {
            type: "object",
            properties: {
              skill: { type: "string", description: "The required skill, copied verbatim from the job's list." },
              status: {
                type: "string",
                enum: ["evidenced", "partial", "not_evidenced"],
                description: "evidenced = the candidate data directly supports this skill, in any language. partial = adjacent or general experience supports it but the named skill, tool or framework is not itself shown. not_evidenced = nothing in the candidate data supports it.",
              },
              evidence: {
                type: ["string", "null"],
                description: "For evidenced and partial: a short quote or close paraphrase of the candidate wording relied on, in the source language. Null only when status is not_evidenced.",
              },
              source: {
                type: ["string", "null"],
                description: "Where the evidence came from: the listed skills, the profile summary, a named role or company, the résumé, or a scorecard. Null only when status is not_evidenced.",
              },
            },
            required: ["skill", "status", "evidence", "source"],
            additionalProperties: false,
          },
        },
        data_sources_used: { type: "array", items: { type: "string" } },
        data_sources_missing: { type: "array", items: { type: "string" } },
        detected_languages: {
          type: "object",
          properties: {
            summary: { type: "string", description: "English language name, or Mixed when sources differ" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            sources: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  code: { type: "string", description: "ISO 639-1 language code" },
                  name: { type: "string", description: "English language name" },
                },
                required: ["label", "code", "name"],
                additionalProperties: false,
              },
            },
          },
          required: ["summary", "confidence", "sources"],
          additionalProperties: false,
        },
      },
      required: ["overall_score", "confidence", "confidence_reason", "profile_summary", "executive_summary", "must_haves", "changes_since_last", "dimensions", "validation_points", "skill_evidence", "data_sources_used", "data_sources_missing", "detected_languages"],
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
6. For salary alignment, judge the expectation against the band symmetrically, using the figures exactly as given (both sides are already on the same currency and period): inside the band = aligned; up to 25% above the maximum = negotiable, no penalty; more than 25% above the maximum = mismatch, above budget; up to 25% below the minimum = a POSITIVE signal (the candidate comes in under budget, leaving headroom on the offer) — never describe it as a concern, a risk, or a red flag; more than 25% below the minimum = a negative signal worth understanding, phrased as a question to ask (it may point to a different market or industry, or to someone who does not yet know what this role pays), never as a disqualification. If salary data is missing on either side, or the candidate figure is marked NOT COMPARABLE, return null for this dimension and do not mention salary anywhere in the analysis.
7. Every gap, mismatch, or concern must explicitly reference: (a) the exact job requirement or job datum, and (b) the exact candidate datum, or explicitly state that the data is unavailable.
8. When evidence is ambiguous, incomplete, or missing, prefer a neutral assessment over a negative inference.
9. The executive_summary must be 1-2 sentences ONLY, and must mention the candidate's strongest fit signal AND biggest hiring risk.
10. Weights must sum to 100.

MUST-HAVES (must_haves)

Read the job description and list what it states as mandatory: "must", "required", "essential", "minimum N years", "must be based in", "fluent in", a specific certification or degree. At most 8. The SKILLS TO CHECK list is not a list of must-haves: a skill tagged [must-have] there is handled separately by the system from its skill verdict, and a tool or method tagged [nice-to-have] or [extra] is only a must-have when the description says it is required. For each one: met when the candidate data shows it, partial when adjacent experience supports it, not_met only when the candidate data explicitly contradicts it, unknown when there is no data either way. "Not mentioned" is unknown, never not_met.

HOW THE SCORE IS BOUNDED

overall_score is your holistic judgement of the whole case, not an average of the dimensions. After you return it, the system enforces these rules, so apply them yourself first:
- A dealbreaker dimension (Location, Salary or Language at 30 or below) caps the score at 55.
- Two or more must-haves not_met cap it at 70; one not_met caps it at 79.
- A score above 80 needs at least three strong matches (must-haves met plus skills evidenced) and no must-have not_met.
- A red tenure flag caps it at 69.
- The score never sits more than 10 points above the weighted mean of the scored dimensions.

INTERVIEW EVIDENCE

Scorecards, when supplied, are first-hand evidence and outrank the résumé on the same point. A scorecard that contradicts a CV claim lowers that skill; a "no" or "strong_no" rating is a material risk to name in the executive summary; a "strong_yes" with specifics strengthens the matching dimension. A validation point that a scorecard already answers must not be asked again: leave it out.

RE-SCORING

When a PREVIOUS ASSESSMENT is supplied, compare against it. If new evidence arrived (a scorecard, a new résumé, changed requirements), say in changes_since_last what it was and how it moved the score. If nothing material changed, keep each dimension within 3 points of the previous one and say so. Scores must not drift without a reason.

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

DIMENSIONS TO EVALUATE (use these exact names and weights; they sum to 100):
- Skills Alignment (weight 30): Match candidate skills/tools against job requirements. List specific matches and gaps.
- Experience Level (weight 20): Years of experience against the job's stated range when one is given, seniority level, career trajectory, and the relevance of past employers (do not reward prestige that is not relevant to the role).
- Role & Title Fit (weight 15): How well current/past titles align with the target role.
- Tenure & Progression (weight 10): The user message supplies TENURE & PROGRESSION facts computed from dated work history, with a flag and a score band. Score inside that band and write the verdict from the facts: name the short stints, the settling, or the promotion. If the flag is unknown, return null.
- Location Compatibility (weight 10): Remote/onsite/hybrid alignment, timezone, relocation, including any additional locations the job lists.
- Salary Alignment (weight 10): Compare using the exact numeric values given; both sides are already expressed in the same currency and period, so never re-convert, approximate or paraphrase them. Score the band symmetrically: inside the band = aligned (high score); up to 25% above the maximum = negotiable, no penalty; more than 25% above the maximum = mismatch above budget (low score); up to 25% below the minimum = a positive signal, under budget with offer headroom (high score, stated as good news); more than 25% below the minimum = negative signal (lower score) raised as a question to explore, not a disqualification. If salary data is missing on either side, or the candidate figure is marked NOT COMPARABLE, return null for this dimension and do not infer a mismatch.
- Language & Communication (weight 5): Language proficiency vs job requirements.

For each validation_point, suggest the best interview stage to verify (Phone Screen, Technical Interview, Culture Fit, Final Round, etc.).

PER-SKILL ADJUDICATION (skill_evidence)

The user message lists the job's SKILLS TO CHECK. Return exactly one skill_evidence entry per listed skill, in the same order, with the skill string copied verbatim from that list. Do not add skills the job did not list, do not drop one, do not merge two, do not rename or reword one.

Rule for each skill:
- evidenced: the candidate data directly supports it. Read everything supplied — listed skills, profile summary, work experience, résumé and scorecards — not just the skills array. Cross-language equivalents count ("Ventas" = "Sales"), as do close variants of the same thing ("Outbound Sales" evidences "Outbound", "B2B sales" evidences "B2B").
- partial: adjacent or general experience supports the area, but the named skill, tool, method or framework is not itself shown. Selling to enterprise accounts is partial evidence of "Enterprise"; running a full sales cycle is partial evidence of "E2E Sales".
- not_evidenced: nothing in the supplied data supports it. Named methodologies and tools (MEDDICC, HubSpot, a specific CRM) are not_evidenced unless the candidate data actually names them or an unmistakable equivalent. Do not infer a tool from the fact that the role would normally use one.

Evidence is mandatory for evidenced and partial: quote or closely paraphrase the candidate's own wording, in its source language, and name where it came from. If you cannot point to a specific phrase, the status is not_evidenced. Never invent or embellish a quote.

These verdicts must agree with the Skills Alignment dimension's matches and gaps — they are the same judgement stated per skill.`;

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

  // Kept outside the try so a failure can mark the suggestion row, not just log.
  let failureClient: ReturnType<typeof createClient> | null = null;
  let suggestionRowId: string | null = null;

  try {
    // Signed-in members and our own queue only: the public key alone could
    // otherwise spend AI credits (2026-10-14).
    const role = jwtRole(req.headers.get("Authorization") ?? "");
    if (role !== "authenticated" && role !== "service_role") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { candidate_id, job_id, force, trigger: rawTrigger } = await req.json();
    const trigger = TRIGGERS.has(rawTrigger) ? String(rawTrigger) : (role === "service_role" ? "queue" : "unknown");
    if (!candidate_id || !job_id) {
      return new Response(JSON.stringify({ error: "candidate_id and job_id are required" }), {
        status: 400,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // A signed-in caller must belong to the workspace that owns both records.
    const access = await checkRecordAccess(req, sb as any, { candidateId: candidate_id, jobId: job_id }, { requireRefs: true });
    if (!access.ok) return accessDenied(access, headers);

    // Fetch all data in parallel
    const [candidateRes, jobRes, workExpRes, educationRes, attachmentsRes, scorecardsRes, associationRes, suggestionRes] = await Promise.all([
      sb.from("candidates").select("*").eq("id", candidate_id).maybeSingle(),
      sb.from("jobs").select("*").eq("id", job_id).maybeSingle(),
      sb.from("candidate_work_experience").select("*").eq("candidate_id", candidate_id).order("start_date", { ascending: false }),
      sb.from("candidate_education").select("*").eq("candidate_id", candidate_id),
      sb.from("candidate_attachments").select("*").eq("candidate_id", candidate_id).eq("is_resume", true).limit(1),
      sb.from("job_stage_scorecards").select("id, rating, general_overview, is_ai_draft, created_at, scorecard_question_responses(answer_text, answer_options, question:scorecard_interview_questions(question_text))").eq("job_id", job_id).eq("candidate_id", candidate_id),
      sb.from("job_candidate_associations").select("id, ai_fit_version, output_language, ai_fit_keep_proper_nouns, ai_fit_analysis, ai_fit_score, ai_fit_generated_at").eq("candidate_id", candidate_id).eq("job_id", job_id).maybeSingle(),
      sb.from("job_suggested_candidates_cache").select("id, ai_fit_analysis, ai_fit_score, ai_fit_generated_at").eq("candidate_id", candidate_id).eq("job_id", job_id).maybeSingle(),
    ]);

    const candidate = candidateRes.data;
    const job = jobRes.data;
    const association = associationRes.data;
    // Suggestion-scoped run: the person is not on this pipeline, so the dossier is
    // hosted on the job's disposable suggestion row instead of an application.
    const suggestion = association ? null : suggestionRes.data;

    if (!candidate || !job) {
      return new Response(JSON.stringify({ error: "Candidate or job not found" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (!association && !suggestion) {
      return new Response(JSON.stringify({ error: "No association found between candidate and job" }), {
        status: 404,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    if (suggestion) {
      failureClient = sb;
      suggestionRowId = suggestion.id;
      await sb
        .from("job_suggested_candidates_cache")
        .update({ dossier_status: "pending", dossier_error: null })
        .eq("id", suggestion.id);
    }

    const { data: organization } = await sb
      .from("organizations")
      .select("default_output_language")
      .eq("id", job.organization_id)
      .maybeSingle();
    const requestedLanguage = association?.output_language || job.output_language || organization?.default_output_language || "en";
    const outputLanguage = SUPPORTED_LANGUAGES[requestedLanguage] ? requestedLanguage : "en";
    const keepProperNouns = association ? association.ai_fit_keep_proper_nouns !== false : true;

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
    // --- Salary: reconcile currency and period before any comparison --------
    // The posted band (salary_min/max, in jobs.currency) is entered as a yearly
    // figure; the budget fields carry their own explicit period.
    const bandMin = job.salary_min ?? job.budget_salary_min ?? null;
    const bandMax = job.salary_max ?? job.budget_salary_max ?? null;
    const usesPostedBand = job.salary_min != null || job.salary_max != null;
    const bandCurrency = String(
      (usesPostedBand ? job.currency : job.budget_currency) || job.currency || "USD",
    ).toUpperCase();
    const bandPeriod = usesPostedBand ? "annually" : String(job.budget_period || "monthly");

    if (candidate.salary_amount) {
      const rawSalary = `${candidate.salary_currency || "USD"} ${Number(candidate.salary_amount).toLocaleString("en-US")} ${candidate.salary_period || "annually"}`;
      const rates = await loadCurrencyRates(sb, job.tenant_id ?? candidate.tenant_id ?? null);
      const normalised = normaliseSalary(
        candidate.salary_amount,
        candidate.salary_currency,
        candidate.salary_period,
        bandCurrency,
        bandPeriod,
        rates,
      );
      // Guard against a pay-period assumption error on the job side: an order of
      // magnitude apart means the two figures are not on the same basis, and a
      // "mismatch" would be an artefact rather than a finding.
      const reference = Number(bandMin ?? bandMax ?? 0);
      const offScale = !!normalised && reference > 0 &&
        (normalised.amount / reference > 10 || reference / normalised.amount > 10);

      if (!normalised || offScale) {
        candidateContext += `\nSalary expectation: ${rawSalary} — NOT COMPARABLE with this job's band (${bandCurrency} ${bandPeriod} basis). Do not score or discuss salary alignment.`;
        dataMissing.push("salary_uncomparable");
      } else {
        candidateContext += normalised.converted
          ? `\nSalary expectation: ${formatMoney(normalised.amount, normalised.currency)} ${normalised.period} (converted from ${rawSalary} at today's rate — use the converted figure for every comparison and state it as approximate)`
          : `\nSalary expectation: ${rawSalary}`;
        dataSources.push("salary");
      }
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
    const resumeText = attachmentsRes.data?.length ? await loadResumeText(sb, candidate_id) : "";
    if (resumeText) {
      candidateContext += `\n\nRESUME TEXT (verbatim, primary evidence for experience and skills):\n${resumeText.slice(0, 12000)}`;
    }
    if (resumeText) {
      dataSources.push("resume");
    } else if (attachmentsRes.data?.length) {
      // A file is on record but nothing readable came out of it: say so rather
      // than claim the résumé was used.
      candidateContext += `\n\nRESUME: a file is on record but its text could not be read, so it is not available as evidence.`;
      dataMissing.push("resume_unreadable");
    } else {
      dataMissing.push("resume");
    }

    // Tenure & progression, computed from the dated work history (tenure.ts).
    const tenure = analyseTenure(workExp);
    candidateContext += `\n\nTENURE & PROGRESSION (computed from dated work history):\nFlag: ${tenure.flag}${tenure.band ? ` — score this dimension between ${tenure.band[0]} and ${tenure.band[1]}` : " — return null for this dimension"}\n${tenure.facts}`;

    // Scorecards (submitted only)
    const scorecards = (scorecardsRes.data || []).filter((sc: any) => !sc.is_ai_draft);
    if (scorecards.length > 0) {
      candidateContext += "\n\nSCORECARD EVALUATIONS:";
      scorecards.forEach((sc: any, idx: number) => {
        candidateContext += `\n- Scorecard ${idx + 1}: overall rating ${sc.rating ?? "n/a"}`;
        if (sc.general_overview) candidateContext += `\n  Key takeaways: ${String(sc.general_overview).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000)}`;
        (sc.scorecard_question_responses || []).forEach((r: any) => {
          const q = r.question?.question_text;
          const a = r.answer_text || (r.answer_options ? JSON.stringify(r.answer_options) : "");
          if (q && a) candidateContext += `\n  Q: ${q} → ${String(a).slice(0, 500)}`;
        });
      });
      dataSources.push("scorecards");
    }

    // Job context
    let jobContext = `JOB: ${job.title}`;
    if (job.description) jobContext += `\nDescription: ${job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}`;
    // The chips adjudicate this exact list, in this exact order, with this
    // spelling. Each skill carries the priority set on the job (2026-10-14):
    // must-have (counts toward the caps), nice-to-have (the skills match), or
    // extra (lifts when present, never a gap).
    const requiredSkills: string[] = (Array.isArray(job.skills) ? job.skills : [])
      .map((skill: unknown) => String(skill || "").trim())
      .filter((skill: string) => skill.length > 0);
    const priorityMap: Record<string, string> = job.skill_priorities && typeof job.skill_priorities === "object" ? job.skill_priorities : {};
    const priorityOf = (skill: string): "must" | "nice" | "bonus" => {
      const direct = priorityMap[skill];
      if (direct === "must" || direct === "nice" || direct === "bonus") return direct;
      const hit = Object.entries(priorityMap).find(([name]) => name.trim().toLowerCase() === skill.trim().toLowerCase());
      return hit && (hit[1] === "must" || hit[1] === "bonus") ? hit[1] : "nice";
    };
    const PRIORITY_LABEL = { must: "must-have", nice: "nice-to-have", bonus: "extra" } as const;
    if (requiredSkills.length) {
      jobContext += `\nSKILLS TO CHECK (adjudicate each one, in this order, using this spelling): ${requiredSkills.map((skill, index) => `${index + 1}. ${skill} [${PRIORITY_LABEL[priorityOf(skill)]}]`).join(" | ")}`;
      jobContext += `\nA [must-have] skill that is not evidenced is a missing must-have. A [nice-to-have] skill is part of the skills match. An [extra] skill lifts the score when evidenced and is never a gap.`;
    }
    if (job.min_years_experience != null || job.max_years_experience != null) {
      jobContext += `\nYears of experience wanted: ${job.min_years_experience ?? "?"} to ${job.max_years_experience ?? "?"}`;
    }
    if (bandMin != null || bandMax != null) {
      jobContext += `\nSalary Band (${bandCurrency}, ${bandPeriod}): min ${bandMin ?? "?"} - max ${bandMax ?? "?"}`;
    }
    if (job.location) jobContext += `\nLocation: ${job.location}`;
    if (Array.isArray(job.additional_locations) && job.additional_locations.length) {
      jobContext += `\nAlso acceptable locations: ${job.additional_locations.filter(Boolean).join(", ")}`;
    }
    if (job.department) jobContext += `\nDepartment: ${job.department}`;

    // Freshness guard: if the candidate row has essentially no data yet
    // (only location captured on the application form) AND was created/updated
    // in the last 60s, enrichment is likely still in flight. Defer rather than
    // persist an empty analysis that would overwrite any prior good score.
    const nonLocationSources = dataSources.filter(s => s !== 'location');
    const candidateTouchedAt = new Date(candidate.updated_at || candidate.created_at || 0).getTime();
    const ageMs = Date.now() - candidateTouchedAt;
    if (nonLocationSources.length === 0 && ageMs < 60_000 && ageMs >= 0) {
      console.log(`[analyze-candidate-fit] Deferring: candidate ${candidate_id} has only ${dataSources.length} data source(s) and was touched ${Math.round(ageMs / 1000)}s ago — awaiting enrichment.`);
      return new Response(
        JSON.stringify({ status: 'deferred', reason: 'awaiting_enrichment' }),
        { status: 202, headers: { ...headers, 'Content-Type': 'application/json' } },
      );
    }

    const allowedLabels = [...new Set(dataSources.map((source) => SOURCE_LABELS[source]).filter(Boolean))];

    // Same inputs, same recipe: hand back the stored dossier instead of paying
    // for a run that could only differ by model noise. A stage move alone
    // therefore never moves the score. `force` (the Refresh button) overrides.
    const inputHash = await sha256(JSON.stringify({ v: PROMPT_VERSION, candidateContext, jobContext, outputLanguage, keepProperNouns }));
    const stored = (association?.ai_fit_analysis ?? suggestion?.ai_fit_analysis ?? null) as Record<string, any> | null;
    if (!force && stored && stored.input_hash === inputHash) {
      const checked = { ...stored, inputs_checked_at: new Date().toISOString() };
      if (association) {
        await sb.from("job_candidate_associations").update({ ai_fit_analysis: checked }).eq("id", association.id);
      } else {
        await sb.from("job_suggested_candidates_cache").update({ ai_fit_analysis: checked, dossier_status: "ready", dossier_error: null }).eq("id", suggestion!.id);
      }
      return new Response(JSON.stringify({ success: true, unchanged: true, analysis: checked }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // A re-score sees what it said last time, so it can explain a change and
    // cannot drift without one.
    let previousBlock = "";
    const previousScore = typeof (association?.ai_fit_score ?? suggestion?.ai_fit_score) === "number"
      ? Number(association?.ai_fit_score ?? suggestion?.ai_fit_score) : null;
    if (stored && Array.isArray(stored.dimensions)) {
      const when = association?.ai_fit_generated_at ?? suggestion?.ai_fit_generated_at ?? null;
      const dims = stored.dimensions.map((d: any) => `${d.name}: ${d.score ?? "null"}`).join("; ");
      const musts = Array.isArray(stored.must_haves) && stored.must_haves.length
        ? stored.must_haves.map((m: any) => `${m.requirement} (${m.status})`).join("; ")
        : "not recorded";
      previousBlock = `\n\nPREVIOUS ASSESSMENT${when ? ` (${String(when).slice(0, 10)})` : ""}: overall ${previousScore ?? "?"}. Dimensions: ${dims}. Must-haves: ${musts}.`;
    }

    // Call OpenAI
    const aiResponse = await openaiFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODELS.reasoning,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${candidateContext}\n\n---\n\n${jobContext}${previousBlock}\n\nLANGUAGE DETECTION: Report source languages separately. Use only these exact source labels because they correspond to inputs actually supplied: ${allowedLabels.join(", ")}. Never report an absent source.` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_fit_analysis" } },
        // Balanced effort: "high" routinely ran past any sane request budget
        // once this call also had to adjudicate every required skill, so every
        // run was cut off before it could return. Medium finishes comfortably
        // and keeps the per-skill judgement intact.
        reasoning_effort: "medium",
      }),
    }, 'analyze-candidate-fit', { timeoutMs: FIT_CALL_TIMEOUT_MS });

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

    const canonicalAnalysis = JSON.parse(toolCall.function.arguments);
    let analysis = canonicalAnalysis;

    // Skill adjudication: keep the job's list authoritative. Every required
    // skill gets exactly one entry, in the job's order and spelling. A model
    // entry that is malformed, unmatched, or claims evidence without quoting
    // any is dropped to not_evidenced rather than guessed at.
    const VALID_SKILL_STATUS = new Set(["evidenced", "partial", "not_evidenced"]);
    const returnedEvidence: any[] = Array.isArray(canonicalAnalysis.skill_evidence)
      ? canonicalAnalysis.skill_evidence
      : [];
    const byNormalizedSkill = new Map<string, any>();
    for (const entry of returnedEvidence) {
      const skill = typeof entry?.skill === "string" ? entry.skill.trim() : "";
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (!byNormalizedSkill.has(key)) byNormalizedSkill.set(key, entry);
    }
    canonicalAnalysis.skill_evidence = requiredSkills.map((skill) => {
      const entry = byNormalizedSkill.get(skill.toLowerCase());
      const status = VALID_SKILL_STATUS.has(entry?.status) ? entry.status : "not_evidenced";
      const evidence = typeof entry?.evidence === "string" && entry.evidence.trim().length > 0
        ? entry.evidence.trim()
        : null;
      const source = typeof entry?.source === "string" && entry.source.trim().length > 0
        ? entry.source.trim()
        : null;
      const priority = priorityOf(skill);
      if (status !== "not_evidenced" && !evidence) {
        return { skill, status: "not_evidenced", evidence: null, source: null, priority };
      }
      if (status === "not_evidenced") {
        return { skill, status, evidence: null, source: null, priority };
      }
      return { skill, status, evidence, source, priority };
    });
    const droppedEvidence = returnedEvidence.length - canonicalAnalysis.skill_evidence.length;
    if (droppedEvidence !== 0) {
      console.log(`[analyze-candidate-fit] skill_evidence reconciled: model returned ${returnedEvidence.length}, job requires ${requiredSkills.length}.`);
    }
    canonicalAnalysis.skill_evidence_version = 3;

    // Override data_sources with our tracked ones
    canonicalAnalysis.data_sources_used = dataSources;
    canonicalAnalysis.data_sources_missing = dataMissing;
    canonicalAnalysis.detected_languages = {
      summary: canonicalAnalysis.detected_languages?.summary || "English",
      confidence: canonicalAnalysis.detected_languages?.confidence || "low",
      sources: (canonicalAnalysis.detected_languages?.sources || [])
        .filter((source: any) => allowedLabels.includes(source.label))
        .map((source: any) => ({ label: source.label, code: String(source.code || "").toLowerCase().slice(0, 2), name: source.name })),
    };

    // Enforce null scores for dimensions where data is deterministically missing
    const salaryUncomparable = dataMissing.includes('salary_uncomparable');
    if ((dataMissing.includes('salary') || salaryUncomparable) && canonicalAnalysis.dimensions) {
      const salaryDim = canonicalAnalysis.dimensions.find(
        (d: any) => d.name?.toLowerCase().includes('salary')
      );
      if (salaryDim && salaryDim.score !== null) {
        salaryDim.score = null;
        salaryDim.insight = salaryUncomparable
          ? 'The salary expectation on file cannot be compared with this job\'s band (different currency or pay period, with no exchange rate available).'
          : 'No salary data available for this candidate.';
        salaryDim.matches = [];
        salaryDim.gaps = [];
      }
    }

    // Must-haves: keep only well-formed entries; `unknown` is the default.
    const MUST_STATUS = new Set(["met", "partial", "not_met", "unknown"]);
    canonicalAnalysis.must_haves = (Array.isArray(canonicalAnalysis.must_haves) ? canonicalAnalysis.must_haves : [])
      .filter((m: any) => typeof m?.requirement === "string" && m.requirement.trim())
      .slice(0, 8)
      .map((m: any) => ({
        requirement: m.requirement.trim(),
        status: MUST_STATUS.has(m.status) ? m.status : "unknown",
        evidence: typeof m.evidence === "string" && m.evidence.trim() ? m.evidence.trim() : null,
      }));

    // Skills the recruiter marked must-have join the must-haves list with the
    // skill verdict as their status, unless the model already listed them.
    const SKILL_TO_MUST = { evidenced: "met", partial: "partial", not_evidenced: "not_met" } as const;
    for (const entry of canonicalAnalysis.skill_evidence) {
      if (entry.priority !== "must") continue;
      const needle = entry.skill.toLowerCase();
      const covered = canonicalAnalysis.must_haves.some((m: any) => String(m.requirement).toLowerCase().includes(needle));
      if (covered || canonicalAnalysis.must_haves.length >= 12) continue;
      canonicalAnalysis.must_haves.push({
        requirement: `Skill: ${entry.skill}`,
        status: SKILL_TO_MUST[entry.status as keyof typeof SKILL_TO_MUST] ?? "unknown",
        evidence: entry.evidence,
      });
    }

    // Tenure: the band is computed, not judged. Clamp the model's score to it.
    const tenureDim = (canonicalAnalysis.dimensions || []).find((d: any) => /tenure/i.test(d.name || ""));
    if (tenureDim) {
      if (!tenure.band) {
        tenureDim.score = null;
        tenureDim.insight = tenureDim.insight || tenure.facts;
      } else if (typeof tenureDim.score === "number") {
        tenureDim.score = Math.max(tenure.band[0], Math.min(tenure.band[1], Math.round(tenureDim.score)));
      } else {
        tenureDim.score = tenure.band[0];
      }
      tenureDim.verdict = tenureDim.verdict || tenure.label;
    }

    // The overall score is the model's holistic judgement, bounded by the
    // rules the prompt states. The old code replaced it with the weighted mean
    // of the dimensions, which let a dealbreaker average away (2026-10-14).
    const dims: any[] = canonicalAnalysis.dimensions || [];
    let totalWeight = 0, weightedSum = 0;
    for (const dim of dims) {
      if (typeof dim.score === "number") { totalWeight += dim.weight || 0; weightedSum += dim.score * (dim.weight || 0); }
    }
    const weightedMean = totalWeight > 0 ? weightedSum / totalWeight : null;
    const modelScore = Math.max(0, Math.min(100, Math.round(Number(canonicalAnalysis.overall_score) || 0)));
    const rules: string[] = [];
    let overall = modelScore;
    const cap = (limit: number, why: string) => { if (overall > limit) { overall = limit; rules.push(why); } };
    if (weightedMean != null) cap(Math.round(weightedMean + 10), `Held within 10 points of the dimension mean (${weightedMean.toFixed(0)}).`);
    for (const dim of dims) {
      if (/location|salary|language/i.test(dim.name || "") && typeof dim.score === "number" && dim.score <= 30) {
        cap(55, `${dim.name} is a dealbreaker at ${dim.score}; capped at 55.`);
      }
    }
    const notMet = canonicalAnalysis.must_haves.filter((m: any) => m.status === "not_met").length;
    const met = canonicalAnalysis.must_haves.filter((m: any) => m.status === "met").length;
    if (notMet >= 2) cap(70, `${notMet} must-haves not met; capped at 70.`);
    else if (notMet === 1) cap(79, `One must-have not met; capped at 79.`);
    const evidencedSkills = canonicalAnalysis.skill_evidence.filter((e: any) => e.status === "evidenced").length;
    const strongMatches = met + evidencedSkills;
    if (strongMatches < 3) cap(80, `Above 80 needs three strong matches: must-haves met plus skills evidenced (${strongMatches} found).`);
    if (tenure.flag === "red") cap(69, `Job-hopping pattern; capped at 69.`);
    canonicalAnalysis.overall_score = overall;
    canonicalAnalysis.scoring = {
      version: PROMPT_VERSION,
      trigger,
      model_score: modelScore,
      weighted_mean: weightedMean == null ? null : Math.round(weightedMean * 10) / 10,
      rules_applied: rules,
      previous_score: previousScore,
      tenure: { flag: tenure.flag, label: tenure.label, band: tenure.band, short_stints: tenure.shortStints, promotions: tenure.promotions, median_stint_months: tenure.medianStintMonths, median_role_months: tenure.medianRoleMonths },
    };
    canonicalAnalysis.changes_since_last = stored ? (typeof canonicalAnalysis.changes_since_last === "string" && canonicalAnalysis.changes_since_last.trim() ? canonicalAnalysis.changes_since_last.trim() : null) : null;
    canonicalAnalysis.input_hash = inputHash;
    canonicalAnalysis.inputs_checked_at = new Date().toISOString();

    // Score first, then translate prose only. Invariant values are always copied
    // back from the canonical analysis so output language cannot affect scoring.
    if (outputLanguage !== "en") {
      const translationResponse = await openaiFetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODELS.reasoning,
          messages: [
            {
              role: "system",
              content: `Translate only the human-readable prose in this recruiting dossier into ${SUPPORTED_LANGUAGES[outputLanguage]}. Preserve meaning and evidence exactly. Do not alter numbers, scores, weights, confidence, priorities, source keys, language detection, array order, or evidence membership. ${keepProperNouns ? "Keep company names, institutions, certifications, product names, and job titles exactly as written in the source." : "Translate proper nouns only when a standard localized form exists."}`,
            },
            { role: "user", content: JSON.stringify(canonicalAnalysis) },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "submit_fit_analysis" } },
          reasoning_effort: "medium",
        }),
      }, "analyze-candidate-fit-translation", { timeoutMs: TRANSLATION_CALL_TIMEOUT_MS });
      if (!translationResponse.ok) {
        const message = await translationResponse.text();
        console.error("Translation error:", translationResponse.status, message);
        throw new Error(`Translation failed: ${translationResponse.status}`);
      }
      const translatedData = await translationResponse.json();
      const translatedArguments = translatedData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!translatedArguments) throw new Error("No structured translation from AI");
      const translated = JSON.parse(translatedArguments);
      analysis = mergeTranslatedProse(canonicalAnalysis, translated);
    }

    // Store in database — on the application when there is one, otherwise on the
    // job's suggestion row, which is copied onto the application if they are added.
    const currentVersion = association?.ai_fit_version || 0;
    const { error: updateError } = association
      ? await sb
          .from("job_candidate_associations")
          .update({
            ai_fit_score: analysis.overall_score,
            ai_fit_analysis: analysis,
            ai_fit_confidence: analysis.confidence,
            ai_fit_generated_at: new Date().toISOString(),
            ai_fit_version: currentVersion + 1,
            ai_fit_output_language: outputLanguage,
          })
          .eq("id", association.id)
      : await sb
          .from("job_suggested_candidates_cache")
          .update({
            ai_fit_score: analysis.overall_score,
            ai_fit_analysis: analysis,
            ai_fit_confidence: analysis.confidence,
            ai_fit_generated_at: new Date().toISOString(),
            ai_fit_output_language: outputLanguage,
            dossier_status: "ready",
            dossier_error: null,
          })
          .eq("id", suggestion!.id);

    if (updateError) {
      console.error("DB update error:", updateError);
      throw new Error(`Failed to store analysis: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-candidate-fit error:", err);
    if (failureClient && suggestionRowId) {
      await failureClient
        .from("job_suggested_candidates_cache")
        .update({ dossier_status: "failed", dossier_error: (err as Error)?.message || "Assessment failed" })
        .eq("id", suggestionRowId);
    }
    // A timeout is reported distinctly so the UI can say the assessment ran long
    // rather than implying the candidate data is at fault. Stored ai_fit_*
    // columns are untouched on any failure path.
    if (err instanceof OpenAiTimeoutError) {
      return new Response(JSON.stringify({ error: "timeout", message: err.message }), {
        status: 504,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
