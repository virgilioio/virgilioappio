

# Rollback Keyword Scoring, Restore Pure AI Fit Analysis

## What happened

The deterministic keyword scoring system (`keywordScoring.ts`) was layered on top of the AI fit analysis. It overrides the AI's `overall_score` with a keyword-based score (line 382), adds a `keyword_analysis` block to the UI, and feeds keyword context into the AI prompt. This produced misleading scores (e.g., Mónica's 34%) because keyword matching is brittle across languages and title formats.

The user wants to go back to letting the AI do a natural language comparison of the full candidate profile against the full job description, returning its own confidence-based 0-100 score.

## Changes

### 1. `supabase/functions/analyze-candidate-fit/index.ts` — Remove keyword scoring, let AI own the score

- Remove import of `keywordScoring.ts` (line 5)
- Remove `generatePriorityKeywords()` function (lines 63-146)
- Remove the keyword scoring block (lines 234-247): no more `scoreCandidate()`, `buildCandidateCorpus()`
- Remove `keywordContext` string (lines 336-342) — stop feeding keyword data to the AI
- **Stop overriding** `analysis.overall_score` (remove line 382)
- **Stop adding** `analysis.keyword_analysis` (remove lines 384-392)
- Update `SYSTEM_PROMPT` (line 148-169):
  - Remove the instruction about grounding on keyword analysis
  - Tell the AI: "Return an overall_score from 0-100 representing how well this candidate fits this job, considering ALL available data holistically. This is YOUR assessment, not a keyword match."
  - Keep everything else (dimensions, validation points, data source tracking)

### 2. `src/components/candidates/insights/CandidateInsightsTab.tsx` — Remove Keyword Match card

- Remove the entire "Keyword Match Breakdown" card (lines 107-163)
- Remove unused imports (`Tag`, `CheckCircle2`, `AlertCircle` if no longer needed)

### 3. `src/hooks/useCandidateFitInsights.ts` — Clean up types

- Remove `KeywordAnalysis` interface (lines 23-34)
- Remove `keyword_analysis?: KeywordAnalysis` from `FitAnalysis` (line 41)

### 4. `src/components/sourcing/SourcingProjectHeader.tsx` — Remove keyword stats display

- Remove the "X of Y match keywords" block (lines 289-309)

### 5. Audit: Skill generation + editing workflow

The `JobFormSheet` skill editing flow looks correct:
- Line 100: `setSelectedSkills(job.skills || [])` — loads existing skills on edit
- Lines 336-367: manual add input works
- Lines 368-374: `JobSkillsGenerationPanel` generates and accepts skills
- Line 145: `skills: selectedSkills` in submit data

The "editing skills failing" is likely the `generate-comprehensive-skills` CORS fix we already deployed. Need to verify it's actually deployed and working. If the user means manual editing is failing, I'll check for `organization_id` in the update payload — it's included in `submitData` but not in `UpdateJobData`. Supabase client silently ignores extra fields, so this shouldn't cause failures. But to be safe, I'll ensure the submit only sends known `UpdateJobData` fields.

### 6. `supabase/functions/_shared/keywordScoring.ts` — Keep file but stop importing

Leave the file in place (no harm, not imported). Can be deleted later if desired.

## Files

| File | Change |
|------|--------|
| `supabase/functions/analyze-candidate-fit/index.ts` | Remove keyword scoring override; let AI return its own score; clean up prompt |
| `src/components/candidates/insights/CandidateInsightsTab.tsx` | Remove Keyword Match Breakdown card |
| `src/hooks/useCandidateFitInsights.ts` | Remove `KeywordAnalysis` interface |
| `src/components/sourcing/SourcingProjectHeader.tsx` | Remove keyword stats display |
| `src/components/jobs/JobFormSheet.tsx` | Verify skill editing works; clean submit payload to only known fields |

