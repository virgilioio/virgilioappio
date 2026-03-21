/**
 * Deterministic keyword scoring engine.
 * Scores a candidate corpus against a job's priority keywords.
 *
 * Title match  (40%): OR logic — any title keyword found → 100, else 0
 * Domain exist (35%): % of domain keywords found in corpus
 * Domain dens  (25%): normalized frequency of matched domain keywords
 */

export interface PriorityKeywords {
  title_keywords: string[];
  domain_keywords: string[];
  generated_at?: string;
}

export interface KeywordScoreResult {
  overall_score: number;
  title_match: boolean;
  title_matched_terms: string[];
  domain_existence: {
    score: number;
    matched: string[];
    missing: string[];
  };
  domain_density: {
    score: number;
    keyword_counts: Record<string, number>;
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(corpus: string, term: string): number {
  const pattern = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');
  const matches = corpus.match(pattern);
  return matches ? matches.length : 0;
}

export function scoreCandidate(
  priorityKeywords: PriorityKeywords,
  candidateCorpus: string
): KeywordScoreResult {
  const corpus = candidateCorpus.toLowerCase();

  // --- Title match (40%) ---
  const titleMatched: string[] = [];
  for (const kw of priorityKeywords.title_keywords) {
    if (corpus.includes(kw.toLowerCase())) {
      titleMatched.push(kw);
    }
  }
  const titleMatch = titleMatched.length > 0;
  const titleScore = titleMatch ? 100 : 0;

  // --- Domain existence (35%) ---
  const domainMatched: string[] = [];
  const domainMissing: string[] = [];
  const domainCounts: Record<string, number> = {};

  for (const kw of priorityKeywords.domain_keywords) {
    const count = countOccurrences(corpus, kw);
    if (count > 0) {
      domainMatched.push(kw);
      domainCounts[kw] = count;
    } else {
      domainMissing.push(kw);
    }
  }

  const totalDomain = priorityKeywords.domain_keywords.length;
  const existenceScore = totalDomain > 0
    ? Math.round((domainMatched.length / totalDomain) * 100)
    : 0;

  // --- Domain density (25%) ---
  // Normalize: max possible = if each keyword appeared 5+ times, cap at 100
  const totalHits = Object.values(domainCounts).reduce((a, b) => a + b, 0);
  const maxExpected = totalDomain * 3; // 3 occurrences per keyword = perfect density
  const densityScore = totalDomain > 0
    ? Math.min(100, Math.round((totalHits / maxExpected) * 100))
    : 0;

  // --- Weighted overall ---
  const overall = Math.round(
    titleScore * 0.4 +
    existenceScore * 0.35 +
    densityScore * 0.25
  );

  return {
    overall_score: overall,
    title_match: titleMatch,
    title_matched_terms: titleMatched,
    domain_existence: {
      score: existenceScore,
      matched: domainMatched,
      missing: domainMissing,
    },
    domain_density: {
      score: densityScore,
      keyword_counts: domainCounts,
    },
  };
}

/**
 * Build a searchable text corpus from candidate data.
 */
export function buildCandidateCorpus(candidate: any, workExperience: any[], education: any[]): string {
  const parts: string[] = [];

  if (candidate.candidate_name) parts.push(candidate.candidate_name);
  if (candidate.current_job_title) parts.push(candidate.current_job_title);
  if (candidate.role_current) parts.push(candidate.role_current);
  if (candidate.company_current) parts.push(candidate.company_current);
  if (candidate.profile_summary) parts.push(candidate.profile_summary);
  if (candidate.bio) parts.push(candidate.bio);
  if (candidate.skills?.length) parts.push(candidate.skills.join(' '));
  if (candidate.standardized_skills?.length) parts.push(candidate.standardized_skills.join(' '));
  if (candidate.specialization) parts.push(candidate.specialization);
  if (candidate.functional_area) parts.push(candidate.functional_area);
  if (candidate.coresignal_headline) parts.push(candidate.coresignal_headline);

  for (const we of workExperience) {
    if (we.job_title) parts.push(we.job_title);
    if (we.standardized_title) parts.push(we.standardized_title);
    if (we.company_name) parts.push(we.company_name);
    if (we.description) parts.push(we.description);
    if (we.skills_used?.length) parts.push(we.skills_used.join(' '));
    if (we.company_industry) parts.push(we.company_industry);
  }

  for (const ed of education) {
    if (ed.institution_name) parts.push(ed.institution_name);
    if (ed.field_of_study) parts.push(ed.field_of_study);
    if (ed.degree_type) parts.push(ed.degree_type);
  }

  return parts.join(' ');
}
