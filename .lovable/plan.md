

# Fix: Manual Searches Return 0 Results When Skills Are Empty

## Root Cause

When a user manually adds title keywords (e.g., "Sales Development Representative") in the sidebar without specifying skills, the sourcing project is created with `skills: []` and `title_keywords: ["Sales Development Representative"]`.

The entire matching pipeline gates on `skills`:
- **Local scoring** (`candidateMatching.ts` line 253): appearance (40%) and density (35%) both score 0 when `jobSkills` is empty, so even relevant candidates score ~12 max — below the 20 threshold
- **Apollo search** (`get-job-matching-candidates/index.ts` line 616): `jobSkills.length > 0` check skips Apollo entirely
- Result: 0 candidates returned

## Fix

### 1. `supabase/functions/get-job-matching-candidates/index.ts`

**Derive `jobSkills` from `title_keywords` when skills are empty** (after line 412):

```ts
// If no skills but we have title_keywords, use title_keywords as proxy skills
if (jobSkills.length === 0 && criteria?.title_keywords?.length > 0) {
  jobSkills = criteria.title_keywords;
  console.log(`📋 No skills specified, using title_keywords as skills: ${jobSkills.join(', ')}`);
}
```

This ensures:
- Local candidate scoring has something to match against (role titles in candidate profiles)
- Apollo search gate passes (`jobSkills.length > 0`)
- The `calculateEnhancedCandidateScore` function will match title keywords against candidates' `role_current` and `profile_summary` fields, which is exactly what we want for title-based searches

**Also update the Apollo search gate** (line 616) to be more explicit:

```ts
// Allow Apollo search if we have skills OR title_keywords
const hasSearchableTerms = jobSkills.length > 0 || criteria?.title_keywords?.length > 0;
if (!count_only && organization_id && hasSearchableTerms) {
```

### 2. No other files need changes

The `candidateMatching.ts` scoring functions already handle title matching through `calculateRoleRelevance()` and `analyzeSkillsInCandidate()` — they just need non-empty `jobSkills` input to function. Using title keywords as the skill input is semantically correct because the scoring logic already checks for word overlap between job skills and `role_current`.

## Files

| File | Change |
|------|--------|
| `supabase/functions/get-job-matching-candidates/index.ts` | Derive jobSkills from title_keywords when empty; update Apollo gate |

