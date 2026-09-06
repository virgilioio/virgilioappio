import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor, handlePreflight } from "../_shared/cors.ts";

import { openaiFetch } from '../_shared/openaiFetch.ts';
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

const SENIORITY_WORDS = [
  "senior", "sr", "junior", "jr", "lead", "head", "vp", "vice", "president",
  "director", "chief", "principal", "staff", "intern", "trainee", "entry",
  "mid", "associate", "assistant", "manager",
];

const STOP_WORDS = new Set([
  "and", "or", "the", "for", "with", "of", "in", "at", "to", "a", "an", "de", "del",
  "la", "el", "los", "las", "y", "en", "para", "por", "con", "und", "der", "die",
  "remote", "hybrid", "onsite", "full", "time", "part", "job", "role", "position",
  "we", "you", "our", "your", "will", "have", "are", "is", "be", "as", "that", "this",
  "from", "on", "not", "who", "their", "they", "its", "it", "all", "can", "must",
]);

function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function computeSkillsHash(job: any): string {
  const titleTokens = tokenize(job.title || "");
  const seniority = titleTokens.filter((t) => SENIORITY_WORDS.includes(t)).sort().join(",");
  const parts = [
    (job.title || "").toLowerCase().trim(),
    (job.skills || []).slice().sort().join(",").toLowerCase(),
    seniority,
  ];
  return parts.join("|");
}

// ---------------------------------------------------------------------------
// Deterministic scoring (0-100). No AI.
// Title 40 · Skills 30 · Domain density 20 · Seniority 10
// then × location scope multiplier (1.0 in scope / 0.85 unknown / 0.5 out of scope)
// Missing data reduces a component's contribution but never disqualifies.
// ---------------------------------------------------------------------------

interface JobSignals {
  titleTokens: string[];
  headNoun: string | null;
  modifiers: string[];
  skills: string[];
  domainKeywords: string[];
  country: string | null;
  allowedCountries: Set<string>;
  locationRaw: string;
  isRemote: boolean;
  seniorityRank: number | null;
}


const SENIORITY_RANK: Record<string, number> = {
  intern: 1, trainee: 1, entry: 1,
  junior: 2, jr: 2,
  associate: 3, mid: 3,
  senior: 4, sr: 4,
  lead: 5, staff: 5, principal: 6,
  manager: 5, head: 6,
  director: 7, vp: 8, chief: 9, c_level: 9,
};

function seniorityRankFromTokens(tokens: string[]): number | null {
  let rank: number | null = null;
  for (const t of tokens) {
    const r = SENIORITY_RANK[t];
    if (r !== undefined) rank = rank === null ? r : Math.max(rank, r);
  }
  return rank;
}

// Very rough country grouping used only for partial location credit.
const REGION_BY_COUNTRY: Record<string, string> = {
  "united states": "north-america", usa: "north-america", us: "north-america",
  canada: "north-america", mexico: "north-america",
  brazil: "latam", brasil: "latam", argentina: "latam", chile: "latam",
  colombia: "latam", peru: "latam", uruguay: "latam", paraguay: "latam",
  bolivia: "latam", ecuador: "latam", venezuela: "latam", "costa rica": "latam",
  panama: "latam", guatemala: "latam", "dominican republic": "latam",
  "united kingdom": "europe", uk: "europe", ireland: "europe", spain: "europe",
  portugal: "europe", france: "europe", germany: "europe", netherlands: "europe",
  belgium: "europe", italy: "europe", poland: "europe", sweden: "europe",
  norway: "europe", denmark: "europe", finland: "europe", switzerland: "europe",
  austria: "europe", romania: "europe", "czech republic": "europe", greece: "europe",
  india: "apac", china: "apac", japan: "apac", singapore: "apac", australia: "apac",
  "new zealand": "apac", philippines: "apac", indonesia: "apac", vietnam: "apac",
  thailand: "apac", malaysia: "apac", "south korea": "apac",
  "south africa": "emea", nigeria: "emea", kenya: "emea", egypt: "emea",
  "united arab emirates": "emea", uae: "emea", israel: "emea", turkey: "emea",
};

function regionOf(country: string | null): string | null {
  if (!country) return null;
  return REGION_BY_COUNTRY[normalize(country)] || null;
}

// Spanish/English/abbreviation aliases → canonical country key used by REGION_BY_COUNTRY.
const COUNTRY_ALIASES: Record<string, string> = {
  brasil: "brazil", brazil: "brazil",
  mexico: "mexico",
  peru: "peru",
  "estados unidos": "united states", "united states": "united states",
  usa: "united states", us: "united states", "u s a": "united states",
  "reino unido": "united kingdom", "united kingdom": "united kingdom", uk: "united kingdom",
  espana: "spain", spain: "spain",
  alemania: "germany", germany: "germany",
  francia: "france", france: "france",
  italia: "italy", italy: "italy",
  japon: "japan", japan: "japan",
  canada: "canada",
  colombia: "colombia", argentina: "argentina", chile: "chile",
};

function canonicalCountry(raw: string | null | undefined): string | null {
  const n = normalize(raw || "");
  if (!n) return null;
  return COUNTRY_ALIASES[n] || n;
}

const REGION_ALIASES: Record<string, string> = {
  latam: "latam", "latin america": "latam", "america latina": "latam",
  emea: "emea",
  apac: "apac", asia: "apac", "asia pacific": "apac",
  nam: "north-america", "north america": "north-america", "norteamerica": "north-america",
  europe: "europe", europa: "europe",
};

function regionKey(raw: string | null | undefined): string | null {
  const n = normalize(raw || "");
  if (!n) return null;
  return REGION_ALIASES[n] || null;
}

function countriesInRegion(region: string): string[] {
  return Object.entries(REGION_BY_COUNTRY)
    .filter(([, r]) => r === region)
    .map(([c]) => c);
}

function extractCountryFromLocation(location: string): string | null {
  const parts = (location || "").split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return canonicalCountry(parts[parts.length - 1]);
}

/**
 * Authoritative geographic scope for the job:
 *   a) additional_locations array wins
 *   b) region name in location / standardized_location expands to member countries
 *   c) a single country named in location
 *   d) empty set → no scope, location is neutral for everyone
 */
function buildAllowedCountries(job: any): Set<string> {
  const set = new Set<string>();

  const additional = Array.isArray(job.additional_locations) ? job.additional_locations : [];
  if (additional.length > 0) {
    for (const entry of additional) {
      const c = canonicalCountry(typeof entry === "string" ? entry : entry?.country || entry?.name);
      if (c) set.add(c);
    }
    if (set.size > 0) return set;
  }

  for (const raw of [job.location, job.standardized_location, job.location_requirement]) {
    const region = regionKey(raw);
    if (region) {
      countriesInRegion(region).forEach((c) => set.add(canonicalCountry(c)!));
      if (set.size > 0) return set;
    }
  }

  const single = extractCountryFromLocation(job.location || job.standardized_location || "");
  if (single && REGION_BY_COUNTRY[single]) set.add(single);

  return set;
}


function buildJobSignals(job: any, jobDescription: string): JobSignals {
  const titleTokens = tokenize(job.title || "").filter((t) => !STOP_WORDS.has(t));
  const modifiers = titleTokens.filter((t) => SENIORITY_WORDS.includes(t));
  const contentTokens = titleTokens.filter((t) => !SENIORITY_WORDS.includes(t) && t.length >= 3);
  const headNoun = contentTokens.length > 0 ? contentTokens[contentTokens.length - 1] : null;

  const pk = job.priority_keywords && typeof job.priority_keywords === "object"
    ? job.priority_keywords
    : null;
  const pkTitle: string[] = Array.isArray(pk?.title_keywords) ? pk.title_keywords : [];
  const pkDomain: string[] = Array.isArray(pk?.domain_keywords) ? pk.domain_keywords : [];

  const skills: string[] = ((job.skills || []) as string[]).map((s: string) => normalize(s)).filter(Boolean);

  let domainKeywords: string[];
  if (pkDomain.length > 0) {
    domainKeywords = pkDomain.map((k) => normalize(k)).filter(Boolean);
  } else {
    // Derive from skills + the most significant repeated terms in the description.
    const freq = new Map<string, number>();
    for (const t of tokenize(jobDescription)) {
      if (t.length < 4 || STOP_WORDS.has(t)) continue;
      freq.set(t, (freq.get(t) || 0) + 1);
    }
    const descTerms = [...freq.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([t]) => t);
    domainKeywords = [...new Set([...skills, ...contentTokens, ...descTerms])];
  }

  const extraTitleTokens = pkTitle.flatMap((k) => tokenize(k)).filter((t) => !STOP_WORDS.has(t));

  const locationRaw = job.location || "";
  const isRemote = job.work_mode === "remote" ||
    /\bremote\b|\bteletrabajo\b|\bremoto\b/i.test(`${locationRaw} ${jobDescription.slice(0, 800)}`);

  return {
    titleTokens: [...new Set([...contentTokens, ...extraTitleTokens])],
    headNoun,
    modifiers,
    skills: [...new Set(skills)],
    domainKeywords,
    country: extractCountryFromLocation(locationRaw),
    allowedCountries: buildAllowedCountries(job),

    locationRaw,
    isRemote,
    seniorityRank: seniorityRankFromTokens(titleTokens),
  };
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 3 || b.length < 3) return false; // short tokens require exact equality
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (shorter.length < 4) return false;
  return longer.startsWith(shorter) || longer.endsWith(shorter);
}

function scoreTitle(signals: JobSignals, candidate: any): number {
  const candidateTitles = [
    candidate.role_current,
    candidate.current_job_title,
    candidate.standardized_title,
  ].filter(Boolean).map((t: string) => tokenize(t));

  if (candidateTitles.length === 0) return 35 * 0.4; // unknown title → neutral-low, never zero-out
  if (!signals.headNoun) {
    // No usable head noun on the job: give neutral credit rather than fabricate a match.
    return 35 * 0.5;
  }

  let best = 0;
  for (const tokens of candidateTitles) {
    const headMatch = tokens.some((t) => tokenMatch(t, signals.headNoun!));
    if (!headMatch) {
      // Other content words may still align (e.g. "sales" in "Sales Executive").
      const otherHits = signals.titleTokens.filter((jt) =>
        jt !== signals.headNoun && tokens.some((t) => tokenMatch(t, jt))
      ).length;
      if (otherHits > 0) best = Math.max(best, 35 * 0.25);
      continue;
    }
    const candModifiers = tokens.filter((t) => SENIORITY_WORDS.includes(t));
    const modifierMatch = signals.modifiers.length === 0
      ? true
      : signals.modifiers.some((m) => candModifiers.includes(m));
    best = Math.max(best, modifierMatch ? 35 : 35 * 0.8);
  }
  return best;
}

function scoreSkills(signals: JobSignals, candidate: any): number {
  if (signals.skills.length === 0) return 25 * 0.5; // no requirement stated → neutral
  const candidateSkills = [...(candidate.skills || []), ...(candidate.standardized_skills || [])]
    .map((s: string) => normalize(s))
    .filter(Boolean);
  if (candidateSkills.length === 0) return 25 * 0.3; // missing data → reduced, not zero

  const candidateTokens = new Set(candidateSkills.flatMap((s) => s.split(" ")));
  let matched = 0;
  for (const js of signals.skills) {
    const jsTokens = js.split(" ").filter(Boolean);
    const hit = jsTokens.length > 1
      ? candidateSkills.some((cs) => cs === js) ||
        jsTokens.every((jt) => [...candidateTokens].some((ct) => tokenMatch(ct, jt)))
      : [...candidateTokens].some((ct) => tokenMatch(ct, js));
    if (hit) matched++;
  }
  return Math.round((matched / signals.skills.length) * 25);
}

function countWholeWord(corpus: string, term: string): number {
  if (!term) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = corpus.match(new RegExp(`\\b${escaped}\\b`, "g"));
  return matches ? matches.length : 0;
}

function scoreDomain(signals: JobSignals, corpus: string): number {
  if (signals.domainKeywords.length === 0) return 15 * 0.5;
  let hits = 0;
  let present = 0;
  for (const kw of signals.domainKeywords) {
    const n = countWholeWord(corpus, kw);
    if (n > 0) { present++; hits += Math.min(n, 3); }
  }
  const existence = present / signals.domainKeywords.length;
  const density = Math.min(1, hits / (signals.domainKeywords.length * 2));
  return Math.round((existence * 0.6 + density * 0.4) * 15);
}

function scoreLocation(signals: JobSignals, candidate: any): number {
  // Penalty only — never a gate.
  const candCountry = candidate.location_country ? normalize(candidate.location_country) : null;
  if (!candCountry) return 15 * 0.5;
  if (signals.isRemote) return 15 * 0.85;
  if (!signals.country) return 15 * 0.5;
  if (candCountry === signals.country) return 15;
  const jobRegion = regionOf(signals.country);
  const candRegion = regionOf(candCountry);
  if (jobRegion && candRegion && jobRegion === candRegion) return 15 * 0.5;
  return 0;
}

function scoreSeniority(signals: JobSignals, candidate: any): number {
  const candTokens = tokenize(
    [candidate.seniority_level, candidate.role_current, candidate.current_job_title]
      .filter(Boolean).join(" ")
  );
  const candRank = seniorityRankFromTokens(candTokens);
  const years = typeof candidate.years_experience === "number" ? candidate.years_experience : null;

  if (signals.seniorityRank === null) {
    return candRank !== null || years !== null ? 10 * 0.7 : 10 * 0.5;
  }
  if (candRank === null && years === null) return 10 * 0.5; // missing data → neutral

  const impliedRank = candRank ?? (years! >= 12 ? 6 : years! >= 8 ? 5 : years! >= 5 ? 4 : years! >= 2 ? 3 : 2);
  const gap = Math.abs(impliedRank - signals.seniorityRank);
  if (gap === 0) return 10;
  if (gap === 1) return 10 * 0.8;
  if (gap === 2) return 10 * 0.55;
  if (gap === 3) return 10 * 0.35;
  return 10 * 0.2;
}

function deterministicScore(signals: JobSignals, candidate: any): number {
  const corpus = normalize([
    candidate.profile_summary,
    candidate.role_current,
    candidate.current_job_title,
    candidate.standardized_title,
    candidate.company_current,
    candidate.functional_area,
    (candidate.skills || []).join(" "),
    (candidate.standardized_skills || []).join(" "),
    candidate.__corpusExtra || "",
  ].filter(Boolean).join(" "));

  return Math.round(
    scoreTitle(signals, candidate) +
    scoreSkills(signals, candidate) +
    scoreDomain(signals, corpus) +
    scoreLocation(signals, candidate) +
    scoreSeniority(signals, candidate)
  );
}

function buildCandidateSummary(c: any, workExp: any[]): string {
  let summary = `${c.candidate_name}`;
  if (c.role_current) summary += ` | Current: ${c.role_current}`;
  if (c.company_current) summary += ` at ${c.company_current}`;
  if (c.years_experience) summary += ` | ${c.years_experience}y exp`;
  if (c.seniority_level) summary += ` | Seniority: ${c.seniority_level}`;
  if (c.functional_area) summary += ` | Function: ${c.functional_area}`;
  if (c.skills?.length) summary += ` | Skills: ${c.skills.slice(0, 15).join(", ")}`;
  if (c.location_city || c.location_country) {
    summary += ` | Location: ${[c.location_city, c.location_state, c.location_country].filter(Boolean).join(", ")}`;
  }
  if (c.salary_amount) {
    summary += ` | Salary: ${c.salary_currency || "USD"} ${c.salary_amount} ${c.salary_period || "yearly"}`;
  }
  if (c.profile_summary) summary += ` | Summary: ${c.profile_summary.slice(0, 300)}`;

  const recentExp = workExp.slice(0, 5);
  if (recentExp.length > 0) {
    summary += ` | Experience: ${recentExp.map((w: any) => {
      let entry = `${w.job_title || w.standardized_title || "Role"} at ${w.company_name || "—"}`;
      if (w.duration_months) entry += ` (${Math.max(1, Math.round(w.duration_months / 12))}y)`;
      if (w.description) entry += ` — ${String(w.description).replace(/\s+/g, " ").trim().slice(0, 200)}`;
      return entry;
    }).join("; ")}`;
  }

  return summary;
}


serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("Origin") ?? undefined;
  const headers = corsHeadersFor(origin);

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
      .select("id, title, description, skills, location, department, salary_min, salary_max, currency, tenant_id, work_mode, priority_keywords")
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
        // Size of the pool that was compared, not the number that passed.
        searched_count: validCached.length,
        breakdown: { localCandidates: results.length, apolloCandidates: 0, averageMatch: avgScore },
      }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    // 5. No cache — deterministic ranking over the FULL tenant pool, then LLM on the top 40.
    const signals = buildJobSignals(job, jobDescription);

    const CANDIDATE_COLUMNS =
      "id, candidate_name, role_current, company_current, current_job_title, standardized_title, skills, standardized_skills, years_experience, seniority_level, functional_area, location_city, location_state, location_country, salary_amount, salary_currency, salary_period, profile_summary, linkedin_url, source, created_at, enriched_at";

    // Paginate through the entire pool — no 500-row cap, no created_at ordering.
    const allCandidates: any[] = [];
    const PAGE = 1000;
    for (let page = 0; ; page++) {
      const { data: pageRows, error: candError } = await sb
        .from("candidates")
        .select(CANDIDATE_COLUMNS)
        .eq("tenant_id", job.tenant_id)
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);

      if (candError) {
        console.error("Error fetching candidates:", candError);
        throw new Error("Failed to fetch candidates");
      }
      const rows = pageRows || [];
      allCandidates.push(...rows.filter((c: any) => !excludeIds.has(c.id)));
      if (rows.length < PAGE) break;
      if (page > 50) break; // hard safety valve
    }

    // Deterministic score for EVERY candidate in the pool.
    const ranked = allCandidates
      .map((c: any) => ({ candidate: c, base: deterministicScore(signals, c) }))
      .filter((r) => r.base > 0)
      .sort((a, b) => b.base - a.base);

    const TOP_N = 40;
    const shortlist = ranked.slice(0, TOP_N).map((r) => r.candidate);

    if (count_only) {
      return new Response(JSON.stringify({
        total_count: shortlist.length,
        breakdown: { localCandidates: shortlist.length, averageMatch: 0 }
      }), { headers: { ...headers, "Content-Type": "application/json" } });
    }

    if (shortlist.length === 0) {
      return new Response(JSON.stringify({ candidates: [], total_count: 0, searched_count: allCandidates.length, breakdown: { localCandidates: 0, averageMatch: 0 } }), {
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const preFiltered = shortlist;

    // Fetch work experience for the shortlist
    const candidateIds = preFiltered.map((c: any) => c.id);
    const { data: allWorkExp } = await sb
      .from("candidate_work_experience")
      .select("candidate_id, job_title, standardized_title, company_name, duration_months, is_current, description")
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
        const aiResponse = await openaiFetch("https://api.openai.com/v1/chat/completions", {
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
        }, 'get-suggested-candidates');

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
      searched_count: allCandidates.length,
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
