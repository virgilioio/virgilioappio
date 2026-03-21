# Priority Keywords + Manual Input — IMPLEMENTED

## What was done

### 1. Migration ✅
- Added `priority_keywords jsonb DEFAULT NULL` to `jobs` table

### 2. Keyword Scoring Engine ✅
- New shared module: `supabase/functions/_shared/keywordScoring.ts`
- Deterministic scoring: title match (40%), domain existence (35%), domain density (25%)
- `scoreCandidate()` + `buildCandidateCorpus()` functions

### 3. Skills Generation Edge Function ✅
- Updated `generate-comprehensive-skills` to query `standard_job_titles` for title synonyms
- Extracts 5-8 domain keywords via focused AI prompt (tool calling)
- Returns `priority_keywords` alongside existing `skills` and `role_level`

### 4. Fit Analysis Edge Function ✅
- Updated `analyze-candidate-fit` to use keyword scoring engine
- Auto-generates priority keywords if job doesn't have them
- Overrides `overall_score` with deterministic keyword score
- Includes `keyword_analysis` breakdown in stored analysis
- Passes keyword data to OpenAI as grounding context

### 5. Frontend Types ✅
- Extended `FitAnalysis` with `KeywordAnalysis` type in `useCandidateFitInsights.ts`
- `useSkillsGeneration.ts` now returns `priorityKeywords` from response

### 6. Insights UI ✅
- New "Keyword Match" card in `CandidateInsightsTab` showing:
  - Title match badge (green/red)
  - Domain keyword badges with occurrence counts
  - Missing keywords in outline style

### 7. Manual Keyword Input ✅
- `JobFormSheet.tsx`: Input + Plus button for manual keyword entry
- `SkillsGenerationPanel.tsx`: Input + Plus button for manual skill entry
