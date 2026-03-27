import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersOf, handlePreflight } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCORING_PROMPT = `You are a rigorous recruiting AI. Given a job description and a candidate profile, produce a fit score from 0-100.

SCORING BANDS:
90-100: Exceptional fit — strong match on core requirements, minimal gaps
75-89: Strong fit — meets most core requirements
60-74: Mixed — some alignment but meaningful concerns
40-59: Weak — multiple important gaps
0-39: Poor — lacks core requirements

RULES:
- Compare holistically: skills, experience, titles, seniority, industry, location, salary
- Cross-language equivalence: treat equivalent professional terms across languages as matches
- Missing must-haves = significant penalty. 2+ missing must-haves = cap at 70
- Scores above 80 require 3+ strong role-relevant matches with no major gaps
- Do NOT inflate scores. Most candidates should NOT score above 80.
- Missing data should reduce score
- Return a brief 1-sentence rationale`;

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "submit_scores",
    description: "Submit fit scores for candidate batch",
    parameters: {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              candidate_index: { type: "integer", description: "0-based index of the candidate in the batch" },
              score: { type: "integer", minimum: 0, maximum: 100 },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
              rationale: { type: "string", description: "1-sentence explanation" },
            },
            required: ["candidate_index", "score", "confidence", "rationale"],
          },
        },
      },
      required: ["scores"],
      additionalProperties: false,
    },
  },
};

function computeSkillsHash(job: any): string {
  const parts = [
    (job.title || "").toLowerCase().trim(),
    (job.skills || []).slice().sort().join(",").toLowerCase(),
    (job.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500).toLowerCase(),
  ];
  return parts.join("|");
}

function buildCandidateSummary(c: any, workExp: any[]): string {
  let summary = `${c.candidate_name}`;
  if (c.role_current) summary += ` | Current: ${c.role_current}`;
  if (c.company_current) summary += ` at ${c.company_current}`;
  if (c.years_experience) summary += ` | ${c.years_experience}y exp`;
  if (c.skills?.length) summary += ` | Skills: ${c.skills.slice(0, 15).join(", ")}`;
  if (c.location_city || c.location_country) {
    summary += ` | Location: ${[c.location_city, c.location_state, c.location_country].filter(Boolean).join(", ")}`;
  }
  if (c.salary_amount) {
    summary += ` | Salary: ${c.salary_currency || "USD"} ${c.salary_amount} ${c.salary_period || "yearly"}`;
  }
  if (c.profile_summary) summary += ` | Summary: ${c.profile_summary.slice(0, 300)}`;
  
  const recentExp = workExp.slice(0, 3);
  if (recentExp.length > 0) {
    summary += ` | Experience: ${recentExp.map((w: any) => `${w.job_title} at ${w.company_name}${w.duration_months ? ` (${Math.round(w.duration_months/12)}y)` : ""}`).join("; ")}`;
  }
  
  return summary;
}

serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin") ?? undefined;
  const headers = corsHeadersOf(origin);

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const { job_id, limit = 25, count_only = false } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch job data
    const { data: job, error: jobError } = await sb
      .from("jobs")
      .select("id, title, description, skills, location, department, salary_min, salary_max, currency, tenant_id")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const jobDescription = (job.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (jobDescription.length < 30) {
      return new Response(JSON.stringify({ candidates: [], total_count: 0, breakdown: { localCandidates: 0, averageMatch: 0 } }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 2. Get already-associated candidate IDs to exclude
    const { data: existingAssocs } = await sb
      .from("job_candidate_associations")
      .select("candidate_id")
      .eq("job_id", job_id);
    
    const excludeIds = new Set((existingAssocs || []).map((a: any) => a.candidate_id));

    // 3. Compute skills hash for cache
    const skillsHash = computeSkillsHash(job);

    // 4. Check cache
    const { data: cachedScores } = await sb
      .from("job_suggested_candidates_cache")
      .select("candidate_id, ai_fit_score, ai_fit_confidence, ai_fit_rationale")
      .eq("job_id", job_id)
      .eq("job_skills_hash", skillsHash)
      .gte("scored_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const hasFreshCache = cachedScores && cachedScores.length > 0;

    if (hasFreshCache) {
      // Filter out excluded candidates from cache
      const validCached = cachedScores.filter((cs: any) => !excludeIds.has(cs.candidate_id));

      if (count_only) {
        const passCount = validCached.filter((cs: any) => cs.ai_fit_score >= 40).length;
        return new Response(JSON.stringify({ total_count: passCount, breakdown: { localCandidates: passCount, averageMatch: 0 } }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      // Fetch fresh candidate data for cached scores
      const cachedIds = validCached.map((cs: any) => cs.candidate_id);
      const { data: cachedCandidates } = await sb
        .from("candidates")
        .select("id, candidate_name, role_current, company_current, current_job_title, skills, standardized_skills, years_experience, location_city, location_state, location_country, salary_amount, salary_currency, salary_period, profile_summary, linkedin_url, source, created_at, enriched_at")
        .in("id", cachedIds)
        .is("deleted_at", null);

      const candidateMap = new Map((cachedCandidates || []).map((c: any) => [c.id, c]));
      
      const results = validCached
        .filter((cs: any) => cs.ai_fit_score >= 40 && candidateMap.has(cs.candidate_id))
        .map((cs: any) => {
          const c = candidateMap.get(cs.candidate_id)!;
          return buildResponseCandidate(c, cs.ai_fit_score, cs.ai_fit_confidence, cs.ai_fit_rationale);
        })
        .sort((a: any, b: any) => b.ai_fit_score - a.ai_fit_score)
        .slice(0, limit);

      const avgScore = results.length > 0
        ? Math.round(results.reduce((sum: number, c: any) => sum + c.ai_fit_score, 0) / results.length)
        : 0;

      console.log(`✅ Cache hit for job ${job_id}: ${results.length} candidates`);
      return new Response(JSON.stringify({
        candidates: results,
        total_count: results.length,
        breakdown: { localCandidates: results.length, apolloCandidates: 0, averageMatch: avgScore },
      }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 5. No cache — run AI scoring
    const jobSkills = (job.skills || []).map((s: string) => s.toLowerCase());
    const jobTitle = (job.title || "").toLowerCase();
    const titleWords = jobTitle.split(/\s+/).filter((w: string) => w.length > 3);

    let query = sb
      .from("candidates")
      .select("id, candidate_name, role_current, company_current, current_job_title, skills, standardized_skills, years_experience, location_city, location_state, location_country, salary_amount, salary_currency, salary_period, profile_summary, linkedin_url, source, created_at, enriched_at")
      .eq("tenant_id", job.tenant_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: allCandidates, error: candError } = await query;
    if (candError) {
      console.error("Error fetching candidates:", candError);
      throw new Error("Failed to fetch candidates");
    }

    const preFiltered = (allCandidates || []).filter((c: any) => {
      if (excludeIds.has(c.id)) return false;
      
      const candidateSkills = [...(c.skills || []), ...(c.standardized_skills || [])].map((s: string) => s.toLowerCase());
      const candidateTitle = (c.role_current || c.current_job_title || "").toLowerCase();
      
      const hasSkillOverlap = jobSkills.length > 0 && candidateSkills.some((cs: string) => 
        jobSkills.some((js: string) => cs.includes(js) || js.includes(cs))
      );
      
      const hasTitleMatch = titleWords.length > 0 && titleWords.some((tw: string) => 
        candidateTitle.includes(tw)
      );
      
      if (jobSkills.length === 0) return hasTitleMatch || true;
      
      return hasSkillOverlap || hasTitleMatch;
    }).slice(0, 50);

    if (count_only) {
      return new Response(JSON.stringify({ 
        total_count: preFiltered.length, 
        breakdown: { localCandidates: preFiltered.length, averageMatch: 0 } 
      }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (preFiltered.length === 0) {
      return new Response(JSON.stringify({ candidates: [], total_count: 0, breakdown: { localCandidates: 0, averageMatch: 0 } }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // Fetch work experience
    const candidateIds = preFiltered.map((c: any) => c.id);
    const { data: allWorkExp } = await sb
      .from("candidate_work_experience")
      .select("candidate_id, job_title, company_name, duration_months, is_current")
      .in("candidate_id", candidateIds)
      .order("start_date", { ascending: false });

    const workExpMap = new Map<string, any[]>();
    (allWorkExp || []).forEach((w: any) => {
      const list = workExpMap.get(w.candidate_id) || [];
      list.push(w);
      workExpMap.set(w.candidate_id, list);
    });

    // Build job context
    let jobContext = `JOB: ${job.title}`;
    jobContext += `\nDescription: ${jobDescription}`;
    if (job.skills?.length) jobContext += `\nRequired Skills: ${job.skills.join(", ")}`;
    if (job.salary_min || job.salary_max) jobContext += `\nSalary Range: ${job.currency || "USD"} ${job.salary_min || "?"} - ${job.salary_max || "?"}`;
    if (job.location) jobContext += `\nLocation: ${job.location}`;
    if (job.department) jobContext += `\nDepartment: ${job.department}`;

    // Score in batches
    const BATCH_SIZE = 10;
    const scoredCandidates: any[] = [];

    for (let i = 0; i < preFiltered.length; i += BATCH_SIZE) {
      const batch = preFiltered.slice(i, i + BATCH_SIZE);
      
      const candidateSummaries = batch.map((c: any, idx: number) => {
        const workExp = workExpMap.get(c.id) || [];
        return `[${idx}] ${buildCandidateSummary(c, workExp)}`;
      }).join("\n\n");

      const userPrompt = `${jobContext}\n\n---\n\nCANDIDATES TO SCORE:\n\n${candidateSummaries}\n\nScore each candidate against this job. Use the full scoring range. Be rigorous.`;

      try {
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SCORING_PROMPT },
              { role: "user", content: userPrompt },
            ],
            tools: [TOOL_SCHEMA],
            tool_choice: { type: "function", function: { name: "submit_scores" } },
            temperature: 0.2,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI batch error (batch ${i}):`, aiResponse.status, errText);
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          console.error(`No tool call in batch ${i}`);
          continue;
        }

        const result = JSON.parse(toolCall.function.arguments);
        
        for (const score of (result.scores || [])) {
          const candidateIdx = score.candidate_index;
          if (candidateIdx >= 0 && candidateIdx < batch.length) {
            const c = batch[candidateIdx];
            scoredCandidates.push({
              candidate: c,
              ai_fit_score: score.score,
              ai_fit_confidence: score.confidence,
              ai_fit_rationale: score.rationale,
            });
          }
        }
      } catch (batchErr) {
        console.error(`Error scoring batch ${i}:`, batchErr);
        continue;
      }
    }

    // 6. Cache ALL scored results (not just passing ones)
    if (scoredCandidates.length > 0) {
      // Delete old cache for this job first
      await sb.from("job_suggested_candidates_cache").delete().eq("job_id", job_id);
      
      const cacheRows = scoredCandidates.map((sc: any) => ({
        job_id,
        candidate_id: sc.candidate.id,
        ai_fit_score: sc.ai_fit_score,
        ai_fit_confidence: sc.ai_fit_confidence,
        ai_fit_rationale: sc.ai_fit_rationale,
        job_skills_hash: skillsHash,
      }));

      const { error: cacheErr } = await sb
        .from("job_suggested_candidates_cache")
        .upsert(cacheRows, { onConflict: "job_id,candidate_id" });

      if (cacheErr) {
        console.error("Cache write error:", cacheErr);
      } else {
        console.log(`📦 Cached ${cacheRows.length} scores for job ${job_id}`);
      }
    }

    // 7. Filter ≥40% and sort
    const filtered = scoredCandidates
      .filter((sc: any) => sc.ai_fit_score >= 40)
      .sort((a: any, b: any) => b.ai_fit_score - a.ai_fit_score)
      .slice(0, limit)
      .map((sc: any) => buildResponseCandidate(sc.candidate, sc.ai_fit_score, sc.ai_fit_confidence, sc.ai_fit_rationale));

    const avgScore = filtered.length > 0 
      ? Math.round(filtered.reduce((sum: number, c: any) => sum + c.ai_fit_score, 0) / filtered.length)
      : 0;

    console.log(`✅ Suggested candidates for job ${job_id}: ${filtered.length} scored (from ${preFiltered.length} pre-filtered)`);

    return new Response(JSON.stringify({
      candidates: filtered,
      total_count: filtered.length,
      breakdown: {
        localCandidates: filtered.length,
        apolloCandidates: 0,
        averageMatch: avgScore,
      },
    }), { headers: { ...headers, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("get-suggested-candidates error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

function buildResponseCandidate(c: any, score: number, confidence: string, rationale: string) {
  return {
    id: c.id,
    candidate_name: c.candidate_name,
    skills: c.skills,
    standardized_skills: c.standardized_skills,
    location: [c.location_city, c.location_state, c.location_country].filter(Boolean).join(", ") || null,
    location_country: c.location_country,
    location_state: c.location_state,
    location_city: c.location_city,
    linkedin_url: c.linkedin_url,
    salary_amount: c.salary_amount,
    salary_currency: c.salary_currency,
    salary_period: c.salary_period,
    years_experience: c.years_experience,
    current_company: c.company_current,
    current_role: c.role_current || c.current_job_title,
    source: "local",
    created_at: c.created_at,
    enriched_at: c.enriched_at,
    profile_summary: c.profile_summary,
    ai_fit_score: score,
    ai_fit_confidence: confidence,
    ai_fit_rationale: rationale,
    match_score: score,
    match_tier: score >= 75 ? "excellent" : score >= 50 ? "good" : score >= 25 ? "fair" : "minimal",
  };
}
