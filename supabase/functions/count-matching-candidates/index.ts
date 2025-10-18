import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { createSecureCorsHeaders, handleSecureCorsPreFlight } from "../_shared/cors.ts";
import {
  buildCandidateMatchingSummary,
  calculateEnhancedCandidateScore,
  CandidateMatchResult,
  getMatchTier,
  MatchingCriteria
} from "../_shared/candidateMatching.ts";

const corsHeaders = createSecureCorsHeaders();

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

type RawRequest = {
  skills?: string[];
  location?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  salary_period?: string;
  job_title?: string;
  criteria?: {
    skills?: string[];
    location?: string;
    salary_min?: number;
    salary_max?: number;
    currency?: string;
    salary_period?: string;
    job_title?: string;
  };
};

serve(async (req) => {
  const preflight = handleSecureCorsPreFlight(req);
  if (preflight) return preflight;

  try {
    const body: RawRequest = await req.json();
    const criteriaPayload = body.criteria ?? body;

    const skills = Array.isArray(criteriaPayload.skills)
      ? criteriaPayload.skills.filter((skill): skill is string => typeof skill === 'string' && skill.trim().length > 0)
      : [];

    const location = criteriaPayload.location ?? body.location ?? undefined;
    const salary_min = criteriaPayload.salary_min ?? body.salary_min;
    const salary_max = criteriaPayload.salary_max ?? body.salary_max;
    const currency = criteriaPayload.currency ?? body.currency ?? 'USD';
    const jobTitle = criteriaPayload.job_title ?? body.job_title ?? (skills[0] ?? 'Generated Role');

    if (!skills.length) {
      const emptySummary = buildCandidateMatchingSummary([], [], { location, salary_min, salary_max, currency });
      return new Response(JSON.stringify(emptySummary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const candidateFields = `
      id,
      candidate_name,
      skills,
      standardized_skills,
      location_country,
      location_city,
      linkedin_url,
      salary_amount,
      salary_currency,
      salary_period,
      profile_summary,
      years_experience,
      enriched_at,
      company_current,
      role_current
    `;

    const { data: candidates, error } = await supabase
      .from('candidates')
      .select(candidateFields)
      .limit(200);

    if (error) {
      console.error('❌ Error fetching candidates:', error);
      throw error;
    }

    const matchResults: CandidateMatchResult[] = [];

    for (const candidate of candidates ?? []) {
      const score = calculateEnhancedCandidateScore(candidate, skills, { title: jobTitle });

      if (score.total_score >= 30 && score.confidence >= 40) {
        matchResults.push({
          candidate,
          score,
          tier: getMatchTier(score.total_score)
        });
      }
    }

    const matchingCriteria: MatchingCriteria = {
      location,
      salary_min,
      salary_max,
      currency
    };

    const summary = buildCandidateMatchingSummary(matchResults, skills, matchingCriteria);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in count-matching-candidates function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
