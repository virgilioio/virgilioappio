export type MatchTier = 'excellent' | 'good' | 'fair' | 'minimal';

export interface SkillAnalysis {
  skill: string;
  frequency: number;
  contexts: Array<{
    source: 'job_title' | 'description' | 'skills_list' | 'summary';
    prominence: number;
    recency?: number;
  }>;
  density_score: number;
  prominence_score: number;
  recency_score: number;
}

export interface CandidateScore {
  skill_appearance: number;
  skill_density: number;
  experience_relevance: number;
  total_score: number;
  confidence: number;
  match_reasoning: string[];
}

const SKILL_SYNONYMS: Record<string, string[]> = {
  'sales development representative': ['sdr', 'sales development', 'sales rep', 'sales representative', 'bdr', 'business development representative'],
  'javascript': ['js', 'javascript', 'ecmascript', 'node.js', 'nodejs'],
  'react': ['reactjs', 'react.js', 'react native'],
  'python': ['py', 'python3', 'python 3'],
  'customer success': ['cs', 'customer support', 'client success'],
  'project management': ['pm', 'project manager', 'program management'],
  'business development': ['bd', 'biz dev', 'business dev', 'bdr'],
  'machine learning': ['ml', 'artificial intelligence', 'ai', 'deep learning'],
  'data science': ['data scientist', 'data analysis', 'analytics'],
  'full stack': ['fullstack', 'full-stack', 'frontend and backend'],
  'devops': ['dev ops', 'infrastructure', 'site reliability'],
  'quality assurance': ['qa', 'testing', 'test automation'],
  'user experience': ['ux', 'user interface', 'ui', 'ui/ux'],
  'software engineer': ['software developer', 'developer', 'engineer', 'programmer'],
  'marketing': ['digital marketing', 'growth marketing', 'content marketing'],
  'account management': ['account manager', 'key account', 'client management'],
  'human resources': ['hr', 'people operations', 'talent acquisition'],
  'cold calling': ['outbound calling', 'prospecting calls', 'sales calls'],
  'lead generation': ['lead gen', 'prospecting', 'lead qualification']
};

export function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function findSkillSynonyms(skill: string): string[] {
  const normalized = normalizeSkill(skill);

  if (SKILL_SYNONYMS[normalized]) {
    return SKILL_SYNONYMS[normalized];
  }

  for (const [key, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return [key, ...synonyms.filter(s => s !== normalized)];
    }
  }

  return [];
}

export function analyzeSkillsInCandidate(candidate: any, jobSkills: string[]): Map<string, SkillAnalysis> {
  const skillAnalysis = new Map<string, SkillAnalysis>();

  const addSkillContext = (skill: string, source: string, prominence: number, recency?: number) => {
    const normalized = normalizeSkill(skill);
    if (!skillAnalysis.has(normalized)) {
      skillAnalysis.set(normalized, {
        skill: normalized,
        frequency: 0,
        contexts: [],
        density_score: 0,
        prominence_score: 0,
        recency_score: 0
      });
    }

    const analysis = skillAnalysis.get(normalized)!;
    analysis.frequency++;
    analysis.contexts.push({
      source: source as any,
      prominence,
      recency
    });
  };

  const candidateSkills = candidate.skills || candidate.standardized_skills || [];
  candidateSkills.forEach((skill: string) => {
    addSkillContext(skill, 'skills_list', 90, 100);
  });

  if (candidate.role_current) {
    const roleWords = candidate.role_current.toLowerCase().split(/\s+/);
    jobSkills.forEach(jobSkill => {
      const normalized = normalizeSkill(jobSkill);
      if (roleWords.some((word: string) => normalized.includes(word) || word.includes(normalized))) {
        addSkillContext(jobSkill, 'job_title', 100, 100);
      }
    });
  }

  if (candidate.profile_summary) {
    const summary = candidate.profile_summary.toLowerCase();
    jobSkills.forEach(jobSkill => {
      const normalized = normalizeSkill(jobSkill);
      const matches = (summary.match(new RegExp(normalized, 'gi')) || []).length;
      if (matches > 0) {
        for (let i = 0; i < matches; i++) {
          addSkillContext(jobSkill, 'summary', 60, 80);
        }
      }
    });
  }

  skillAnalysis.forEach((analysis) => {
    const totalContexts = analysis.contexts.length;
    analysis.density_score = Math.min(100, (analysis.frequency / totalContexts) * 100);
    analysis.prominence_score = analysis.contexts.reduce((sum, ctx) => sum + ctx.prominence, 0) / totalContexts;
    analysis.recency_score = analysis.contexts.reduce((sum, ctx) => sum + (ctx.recency || 50), 0) / totalContexts;
  });

  return skillAnalysis;
}

export function extractSkillsFromSummary(summary: string): string[] {
  if (!summary) return [];

  const skillKeywords = [
    'sales development representative', 'sdr', 'business development', 'bdr',
    'sales', 'marketing', 'management', 'engineer', 'developer', 'designer', 'analyst',
    'javascript', 'python', 'react', 'node', 'sql', 'aws', 'google', 'microsoft',
    'crm', 'salesforce', 'hubspot', 'excel', 'powerbi', 'tableau', 'jira',
    'recruiting', 'hr', 'human resources', 'onboarding', 'training', 'payroll',
    'customer service', 'support', 'account management', 'cold calling',
    'project management', 'agile', 'scrum', 'digital marketing', 'seo', 'sem',
    'accounting', 'finance', 'operations', 'logistics', 'supply chain',
    'lead generation', 'prospecting', 'outbound', 'inbound', 'qualification'
  ];

  const cleanSummary = summary.toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\w\s]/g, ' ');
  const extractedSkills: string[] = [];

  for (const keyword of skillKeywords) {
    if (cleanSummary.includes(keyword)) {
      extractedSkills.push(keyword);
    }
  }

  return [...new Set(extractedSkills)];
}

function calculateRoleRelevance(currentRole: string, jobSkills: string[], jobTitle: string): number {
  const roleWords = currentRole.toLowerCase().split(/\s+/);
  const titleWords = jobTitle.toLowerCase().split(/\s+/);

  let relevanceScore = 0;

  const titleOverlap = titleWords.filter(word => roleWords.includes(word)).length;
  if (titleWords.length > 0) {
    relevanceScore += (titleOverlap / titleWords.length) * 40;
  }

  const skillMentions = jobSkills.filter(skill =>
    currentRole.toLowerCase().includes(normalizeSkill(skill))
  ).length;
  if (jobSkills.length > 0) {
    relevanceScore += (skillMentions / jobSkills.length) * 60;
  }

  return Math.min(100, relevanceScore);
}

function calculateExperienceAlignment(yearsExp: number): number {
  if (yearsExp >= 2 && yearsExp <= 8) return 100;
  if (yearsExp >= 1 && yearsExp <= 10) return 80;
  if (yearsExp >= 0 && yearsExp <= 15) return 60;
  return 40;
}

export function calculateEnhancedCandidateScore(candidate: any, jobSkills: string[], job: { title?: string }): CandidateScore {
  const reasoning: string[] = [];
  const skillAnalysis = analyzeSkillsInCandidate(candidate, jobSkills);

  let appearanceScore = 0;
  for (const jobSkill of jobSkills) {
    const normalized = normalizeSkill(jobSkill);
    let bestMatch = 0;

    if (skillAnalysis.has(normalized)) {
      bestMatch = 100;
      reasoning.push(`✓ Direct match: ${jobSkill}`);
    } else {
      for (const [candidateSkill] of skillAnalysis) {
        const synonyms = findSkillSynonyms(jobSkill);
        const candidateSynonyms = findSkillSynonyms(candidateSkill);

        if (synonyms.includes(candidateSkill) || candidateSynonyms.includes(normalized)) {
          bestMatch = Math.max(bestMatch, 80);
          reasoning.push(`≈ Synonym match: ${jobSkill} ↔ ${candidateSkill}`);
        } else if (candidateSkill.includes(normalized) || normalized.includes(candidateSkill)) {
          bestMatch = Math.max(bestMatch, 60);
          reasoning.push(`⊃ Partial match: ${jobSkill} ↔ ${candidateSkill}`);
        }
      }
    }

    appearanceScore += bestMatch;
  }

  appearanceScore = jobSkills.length > 0 ? (appearanceScore / jobSkills.length) : 0;

  let densityScore = 0;
  let totalDensity = 0;
  let densityCount = 0;

  skillAnalysis.forEach((analysis, skill) => {
    if (jobSkills.some(js => normalizeSkill(js) === skill)) {
      totalDensity += analysis.density_score * analysis.prominence_score / 100;
      densityCount++;
    }
  });

  densityScore = densityCount > 0 ? (totalDensity / densityCount) : 0;

  let experienceScore = 50;
  const jobTitle = job?.title ?? 'Role';

  if (candidate.role_current) {
    const roleScore = calculateRoleRelevance(candidate.role_current, jobSkills, jobTitle);
    experienceScore = Math.max(experienceScore, roleScore);
    if (roleScore > 70) {
      reasoning.push(`💼 Current role highly relevant: ${candidate.role_current}`);
    }
  }

  if (candidate.company_current) {
    reasoning.push(`🏢 Currently at: ${candidate.company_current}`);
  }

  if (candidate.years_experience) {
    const expAlignment = calculateExperienceAlignment(candidate.years_experience);
    experienceScore = (experienceScore + expAlignment) / 2;
    reasoning.push(`📅 ${candidate.years_experience} years experience`);
  }

  const weightedScore = (
    (appearanceScore * 0.40) +
    (densityScore * 0.35) +
    (experienceScore * 0.25)
  );

  let confidence = 0;
  if (candidate.skills?.length > 0) confidence += 30;
  if (candidate.profile_summary) confidence += 25;
  if (candidate.role_current) confidence += 25;
  if (candidate.years_experience) confidence += 20;

  return {
    skill_appearance: Math.round(appearanceScore),
    skill_density: Math.round(densityScore),
    experience_relevance: Math.round(experienceScore),
    total_score: Math.round(weightedScore),
    confidence: Math.round(Math.min(100, confidence)),
    match_reasoning: reasoning,
  };
}

export function getMatchTier(score: number): MatchTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'minimal';
}

export interface CandidateMatchResult {
  candidate: any;
  score: CandidateScore;
  tier: MatchTier;
}

export interface MatchingCriteria {
  location?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
}

export interface CandidateMatchingSummary {
  totalCandidates: number;
  excellent: number;
  good: number;
  fair: number;
  minimal: number;
  breakdown: {
    salaryMatches: number;
    locationMatches: number;
    coreSignalCandidates: number;
    localCandidates: number;
    creditsUsed: number;
    coreSignalError?: string;
    searchStrategy: string;
    skillsAnalysis: {
      averageMatch: number;
      topSkills: string[];
    };
  };
}

export function buildCandidateMatchingSummary(
  results: CandidateMatchResult[],
  jobSkills: string[],
  criteria: MatchingCriteria
): CandidateMatchingSummary {
  const summary: CandidateMatchingSummary = {
    totalCandidates: 0,
    excellent: 0,
    good: 0,
    fair: 0,
    minimal: 0,
    breakdown: {
      salaryMatches: 0,
      locationMatches: 0,
      coreSignalCandidates: 0,
      localCandidates: 0,
      creditsUsed: 0,
      searchStrategy: 'local-database',
      skillsAnalysis: {
        averageMatch: 0,
        topSkills: []
      }
    }
  };

  if (!results.length) {
    summary.breakdown.skillsAnalysis.topSkills = jobSkills.slice(0, 3);
    return summary;
  }

  const normalizedJobSkills = jobSkills.map(skill => ({
    original: skill,
    normalized: normalizeSkill(skill)
  }));

  const topSkillCounts: Record<string, number> = {};
  let totalScore = 0;

  for (const result of results) {
    summary.totalCandidates++;
    summary.breakdown.localCandidates++;
    summary.breakdown.creditsUsed++;
    totalScore += result.score.total_score;

    if (result.tier === 'excellent') summary.excellent++;
    else if (result.tier === 'good') summary.good++;
    else if (result.tier === 'fair') summary.fair++;
    else summary.minimal++;

    if (criteria.location) {
      const location = criteria.location.toLowerCase();
      const candidateCity = result.candidate.location_city?.toLowerCase() ?? '';
      const candidateCountry = result.candidate.location_country?.toLowerCase() ?? '';
      if (
        (candidateCity && (candidateCity.includes(location) || location.includes(candidateCity))) ||
        (candidateCountry && (candidateCountry.includes(location) || location.includes(candidateCountry)))
      ) {
        summary.breakdown.locationMatches++;
      }
    }

    if (
      typeof criteria.salary_min === 'number' &&
      typeof criteria.salary_max === 'number' &&
      typeof result.candidate.salary_amount === 'number'
    ) {
      const currencyMatches = criteria.currency
        ? (result.candidate.salary_currency ?? '').toLowerCase() === criteria.currency.toLowerCase()
        : true;
      if (
        currencyMatches &&
        result.candidate.salary_amount >= criteria.salary_min &&
        result.candidate.salary_amount <= criteria.salary_max
      ) {
        summary.breakdown.salaryMatches++;
      }
    }

    const skillAnalysis = analyzeSkillsInCandidate(result.candidate, jobSkills);
    for (const jobSkill of normalizedJobSkills) {
      if (skillAnalysis.has(jobSkill.normalized)) {
        topSkillCounts[jobSkill.original] = (topSkillCounts[jobSkill.original] ?? 0) + 1;
      }
    }
  }

  summary.breakdown.skillsAnalysis.averageMatch = Number((totalScore / results.length).toFixed(1));
  summary.breakdown.skillsAnalysis.topSkills = Object.entries(topSkillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skill]) => skill);

  if (!summary.breakdown.skillsAnalysis.topSkills.length) {
    summary.breakdown.skillsAnalysis.topSkills = jobSkills.slice(0, 3);
  }

  return summary;
}
