import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";
import { scoreCandidate, buildCandidateCorpus, type PriorityKeywords, type KeywordScoreResult } from "../_shared/keywordScoring.ts";

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
        overall_score: { type: "integer", minimum: 0, maximum: 100, description: "Overall fit score 0-100" },
        confidence: { type: "string", enum: ["low", "medium", "high"] },
        confidence_reason: { type: "string", description: "Why this confidence level" },
        executive_summary: { type: "string", description: "1-2 sentence summary referencing specific data points" },
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

/**
 * Generate priority keywords on-the-fly if the job doesn't have them yet.
 */
async function generatePriorityKeywords(job: any, sb: any): Promise<PriorityKeywords> {
  const jobTitle = job.title || '';

  // Fetch title synonyms from standard_job_titles
  const titleKeywords = new Set<string>();
  titleKeywords.add(jobTitle.trim());

  try {
    const { data: titleData } = await sb
      .from('standard_job_titles')
      .select('canonical_title, synonyms')
      .or(`canonical_title.ilike.%${jobTitle.trim().toLowerCase()}%`)
      .limit(3);

    if (titleData) {
      for (const row of titleData) {
        if (row.canonical_title) titleKeywords.add(row.canonical_title);
        if (row.synonyms && Array.isArray(row.synonyms)) {
          for (const syn of row.synonyms) titleKeywords.add(syn);
        }
      }
    }
  } catch (e) {
    console.error('Error fetching title keywords:', e);
  }

  // Extract domain keywords via OpenAI
  let domainKeywords: string[] = [];
  const plainDesc = (job.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (plainDesc.length > 30 && OPENAI_API_KEY) {
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Extract 5-8 domain/methodology/industry keywords from this job that identify ideal candidates. NOT job titles. Return ONLY a JSON array of strings.' },
            { role: 'user', content: `Job: ${jobTitle}\n\n${plainDesc}` },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_keywords",
              parameters: {
                type: "object",
                properties: { keywords: { type: "array", items: { type: "string" } } },
                required: ["keywords"],
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "submit_keywords" } },
          temperature: 0.2,
          max_tokens: 300,
        }),
      });
      if (resp.ok) {
        const d = await resp.json();
        const tc = d.choices?.[0]?.message?.tool_calls?.[0];
        if (tc?.function?.arguments) {
          domainKeywords = JSON.parse(tc.function.arguments).keywords || [];
        }
      }
    } catch (e) {
      console.error('Domain keyword extraction failed:', e);
    }
  }

  const pk: PriorityKeywords = {
    title_keywords: Array.from(titleKeywords),
    domain_keywords: domainKeywords.slice(0, 8),
    generated_at: new Date().toISOString(),
  };

  // Store back to job for future use
  try {
    await sb.from('jobs').update({ priority_keywords: pk }).eq('id', job.id);
    console.log('Stored priority_keywords on job', job.id);
  } catch (e) {
    console.error('Failed to store priority_keywords:', e);
  }

  return pk;
}

const SYSTEM_PROMPT = `You are an expert recruiter and talent assessment AI. You analyze a candidate's full profile against a job's requirements to produce a deep, specific fit analysis.

IMPORTANT: You will be given a KEYWORD ANALYSIS that shows a deterministic score based on keyword matching. Use this as GROUNDING CONTEXT — your qualitative insights should explain and contextualize these keyword results, not contradict them.

CRITICAL RULES:
1. NEVER produce generic statements. Every insight MUST reference specific data points from the candidate or job.
2. Return null for dimension scores where data is insufficient — do NOT guess.
3. Flag unknowns explicitly as validation_points for the recruiting team to investigate.
4. Understand company pedigree (e.g., FAANG, YC startups, Fortune 500), tools, seniority implications, language skills, and market context.
5. The executive_summary must be 1-2 sentences and reference THIS candidate's specific strengths/risks against THIS job.
6. Weights must sum to 100.

DIMENSIONS TO EVALUATE (use these exact names):
- Skills Alignment (weight ~30): Match candidate skills/tools against job requirements. List specific matches and gaps.
- Experience Level (weight ~20): Years of experience, seniority level, career trajectory.
- Role & Title Fit (weight ~15): How well current/past titles align with the target role.
- Location Compatibility (weight ~10): Remote/onsite/hybrid alignment, timezone, relocation.
- Salary Alignment (weight ~10): Compare candidate salary expectations vs job range. null if unknown.
- Company Pedigree (weight ~10): Quality and relevance of past employers.
- Language & Communication (weight ~5): Language proficiency vs job requirements.

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

    // --- KEYWORD SCORING ---
    const workExp = workExpRes.data || [];
    const edu = educationRes.data || [];

    // Get or generate priority keywords
    let priorityKeywords: PriorityKeywords | null = job.priority_keywords as PriorityKeywords | null;
    if (!priorityKeywords || !priorityKeywords.title_keywords?.length) {
      priorityKeywords = await generatePriorityKeywords(job, sb);
    }

    // Build candidate corpus and score
    const corpus = buildCandidateCorpus(candidate, workExp, edu);
    const keywordResult: KeywordScoreResult = scoreCandidate(priorityKeywords, corpus);
    console.log('Keyword score:', JSON.stringify(keywordResult));

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

    // Add keyword analysis context for the AI
    const keywordContext = `\n\n--- KEYWORD ANALYSIS (DETERMINISTIC) ---
Overall Keyword Score: ${keywordResult.overall_score}/100
Title Match: ${keywordResult.title_match ? 'YES' : 'NO'} (searched: ${priorityKeywords.title_keywords.join(', ')})${keywordResult.title_matched_terms.length > 0 ? ` — matched: ${keywordResult.title_matched_terms.join(', ')}` : ''}
Domain Keywords Matched: ${keywordResult.domain_existence.matched.join(', ') || 'none'} (${keywordResult.domain_existence.score}%)
Domain Keywords Missing: ${keywordResult.domain_existence.missing.join(', ') || 'none'}
Domain Density: ${JSON.stringify(keywordResult.domain_density.keyword_counts)}
Use this keyword data to ground your qualitative analysis.`;

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
          { role: "user", content: `${candidateContext}\n\n---\n\n${jobContext}${keywordContext}` },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_fit_analysis" } },
        temperature: 0.3,
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

    // Override overall_score with deterministic keyword score
    analysis.overall_score = keywordResult.overall_score;

    // Add keyword_analysis breakdown
    analysis.keyword_analysis = {
      title_match: keywordResult.title_match,
      title_keywords_used: priorityKeywords.title_keywords,
      title_matched_terms: keywordResult.title_matched_terms,
      domain_matched: keywordResult.domain_existence.matched,
      domain_missing: keywordResult.domain_existence.missing,
      domain_counts: keywordResult.domain_density.keyword_counts,
    };

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
      throw new Error("Failed to store analysis");
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("analyze-candidate-fit error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Analysis failed" }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});
