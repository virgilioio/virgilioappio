

# Priority Keywords + Manual Input

## Updated Plan

This is the previously approved "Priority Keywords with Merge + Flag Approach" plan, now with manual keyword/skill entry added.

## All Changes

### 1. Migration: Add `priority_keywords` column to `jobs`
- `ALTER TABLE jobs ADD COLUMN priority_keywords jsonb DEFAULT NULL`

### 2. `supabase/functions/generate-comprehensive-skills/index.ts`
- After generating full skills list (job context), add focused prompt for 5-8 domain keywords
- Query `standard_job_titles` for title synonyms
- Return `priority_keywords` alongside existing `skills` and `role_level`

### 3. New: `supabase/functions/_shared/keywordScoring.ts`
- Deterministic scoring: title match (40%, OR logic), domain existence (35%), domain density (25%)
- `scoreCandidate(priorityKeywords, candidateCorpus)` → score + breakdown

### 4. `supabase/functions/analyze-candidate-fit/index.ts`
- Fetch/generate `priority_keywords`, build candidate corpus, run keyword score
- Override `overall_score` with deterministic result, include `keyword_analysis` breakdown
- Pass to OpenAI as grounding context for qualitative insights only

### 5. `src/hooks/useCandidateFitInsights.ts`
- Extend `FitAnalysis` type with `keyword_analysis` (title_match, domain_matched/missing, counts)

### 6. `src/components/candidates/insights/CandidateInsightsTab.tsx`
- Add keyword match breakdown card (title match badge, domain keyword badges with counts)

### 7. `src/hooks/useSkillsGeneration.ts`
- Return `priority_keywords` from response so caller can save to job record

### 8. Manual keyword/skill input (NEW)

**`src/components/jobs/JobFormSheet.tsx`**: Add an `Input` + Plus button row between the skill badges and `JobSkillsGenerationPanel` in the "Required Skills" section (~line 320). Typing + Enter or click adds the keyword to `selectedSkills` (no duplicates). Same badge + X removal already works.

**`src/components/candidates/SkillsGenerationPanel.tsx`**: Add the same inline input + Plus button at the top of the panel, before the AI Generate button. On add, calls `onSkillsAccepted([...existingSkills, newSkill])`.

Both use the same pattern: small input with placeholder "Add keyword...", Plus icon button, Enter key support, duplicate check.

## Files Summary

| File | Action |
|------|--------|
| Migration SQL | Add `priority_keywords jsonb` to `jobs` |
| `supabase/functions/generate-comprehensive-skills/index.ts` | Add priority keyword extraction for job context |
| `supabase/functions/_shared/keywordScoring.ts` | New — deterministic scoring engine |
| `supabase/functions/analyze-candidate-fit/index.ts` | Use keyword scoring, pass to AI as context |
| `src/hooks/useCandidateFitInsights.ts` | Extend `FitAnalysis` type with `keyword_analysis` |
| `src/components/candidates/insights/CandidateInsightsTab.tsx` | Display keyword match breakdown |
| `src/hooks/useSkillsGeneration.ts` | Return `priority_keywords` from response |
| `src/components/jobs/JobFormSheet.tsx` | Add manual keyword input row in skills section |
| `src/components/candidates/SkillsGenerationPanel.tsx` | Add manual skill input row |

