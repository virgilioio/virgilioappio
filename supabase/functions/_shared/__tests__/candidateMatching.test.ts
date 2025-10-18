import { describe, expect, it } from 'vitest';
import {
  buildCandidateMatchingSummary,
  calculateEnhancedCandidateScore,
  CandidateMatchResult,
  getMatchTier
} from '../candidateMatching';

const baseCandidate = {
  id: '1',
  candidate_name: 'Alex Dev',
  skills: ['JavaScript', 'React', 'TypeScript'],
  standardized_skills: ['javascript', 'react', 'typescript'],
  location_country: 'United States',
  location_city: 'Remote',
  salary_amount: 95000,
  salary_currency: 'USD',
  salary_period: 'annual',
  profile_summary: 'Seasoned Frontend engineer with strong JavaScript and React experience.',
  years_experience: 5,
  company_current: 'Tech Co',
  role_current: 'Senior React Developer'
};

describe('candidate matching helpers', () => {
  it('builds a rich candidate matching summary', () => {
    const jobSkills = ['JavaScript', 'React'];
    const score = calculateEnhancedCandidateScore(baseCandidate, jobSkills, { title: 'Frontend Engineer' });

    const results: CandidateMatchResult[] = [
      {
        candidate: baseCandidate,
        score,
        tier: getMatchTier(score.total_score)
      }
    ];

    const summary = buildCandidateMatchingSummary(results, jobSkills, {
      location: 'Remote',
      salary_min: 80000,
      salary_max: 120000,
      currency: 'USD'
    });

    expect(summary.totalCandidates).toBe(1);
    expect(summary.excellent + summary.good + summary.fair + summary.minimal).toBe(1);
    expect(summary.breakdown.localCandidates).toBe(1);
    expect(summary.breakdown.locationMatches).toBe(1);
    expect(summary.breakdown.salaryMatches).toBe(1);
    expect(summary.breakdown.skillsAnalysis.averageMatch).toBeGreaterThan(0);
    expect(summary.breakdown.skillsAnalysis.topSkills.length).toBeGreaterThan(0);
    expect(summary.breakdown.skillsAnalysis.topSkills).toContain('JavaScript');
  });

  it('returns empty defaults when no candidates match', () => {
    const summary = buildCandidateMatchingSummary([], ['Python', 'Django'], {
      location: 'Berlin',
      salary_min: 60000,
      salary_max: 90000,
      currency: 'EUR'
    });

    expect(summary.totalCandidates).toBe(0);
    expect(summary.breakdown.localCandidates).toBe(0);
    expect(summary.breakdown.skillsAnalysis.topSkills).toEqual(['Python', 'Django'].slice(0, 3));
  });
});
