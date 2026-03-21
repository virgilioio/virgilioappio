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

/**
 * Common title prefixes to strip for core noun phrase matching.
 * E.g., "Coordinación de Cuentas por Pagar" → "Cuentas por Pagar"
 */
const TITLE_PREFIXES = [
  // Spanish
  'coordinación de', 'coordinacion de', 'gerente de', 'director de', 'directora de',
  'jefe de', 'jefa de', 'líder de', 'lider de', 'responsable de',
  'supervisor de', 'supervisora de', 'encargado de', 'encargada de',
  'analista de', 'especialista de', 'especialista en', 'consultor de',
  'asistente de', 'auxiliar de', 'ejecutivo de', 'ejecutiva de',
  // Portuguese
  'coordenador de', 'coordenadora de', 'gerente de', 'diretor de', 'diretora de',
  'chefe de', 'líder de', 'analista de', 'especialista de', 'especialista em',
  'assistente de', 'auxiliar de', 'consultor de', 'executivo de',
  // English
  'manager of', 'head of', 'director of', 'lead of', 'coordinator of',
  'supervisor of', 'specialist in', 'analyst of', 'executive of',
  'senior', 'sr.', 'jr.', 'junior',
];

/**
 * Extract core noun phrase from a title by stripping common prefixes.
 * Returns the core phrase if shorter than original, otherwise null.
 */
function extractCorePhrase(title: string): string | null {
  const lower = title.toLowerCase().trim();
  for (const prefix of TITLE_PREFIXES) {
    if (lower.startsWith(prefix + ' ') || lower.startsWith(prefix)) {
      const remainder = lower.slice(prefix.length).replace(/^\s+/, '');
      if (remainder.length >= 3 && remainder.length < lower.length) {
        return remainder;
      }
    }
  }
  return null;
}

/**
 * Check if a title keyword matches in the corpus, using both exact and core-phrase matching.
 */
function titleKeywordMatches(corpus: string, keyword: string): boolean {
  const kwLower = keyword.toLowerCase();
  // Exact substring match
  if (corpus.includes(kwLower)) return true;
  // Core phrase match for multi-word titles
  const words = kwLower.split(/\s+/);
  if (words.length >= 3) {
    const core = extractCorePhrase(kwLower);
    if (core && corpus.includes(core)) return true;
  }
  return false;
}

export function scoreCandidate(
  priorityKeywords: PriorityKeywords,
  candidateCorpus: string
): KeywordScoreResult {
  const corpus = candidateCorpus.toLowerCase();

  // --- Title match (40%) ---
  const titleMatched: string[] = [];
  for (const kw of priorityKeywords.title_keywords) {
    if (titleKeywordMatches(corpus, kw)) {
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
