

# Upgrade AI Fit Prompt to Rigorous Scoring

## What changes

### 1. `supabase/functions/analyze-candidate-fit/index.ts` — Replace SYSTEM_PROMPT

Swap the current polite, holistic prompt (lines 59-82) with the user's rigorous version. Key differences:

- **Scoring philosophy with defined bands** (90-100 exceptional, 75-89 strong, 60-74 mixed, 40-59 weak, 0-39 poor)
- **Must-have penalty enforcement**: missing critical requirements = meaningful score reduction; 2+ missing must-haves = cap at 70
- **Score above 80 justification**: must cite 3+ strong role-relevant matches with no unresolved must-have gaps
- **Missing data = penalty**, not neutral
- **Anti-averaging rule**: strengths cannot compensate for critical misses
- **Compression guardrail**: avoid clustering in 70-90 range
- **Structured evaluation order**: identify must-haves → nice-to-haves → check misses → apply penalties → score
- **Updated weights**: Language & Communication raised to 10 (from 5), Company Pedigree reduced to 5 (from 10)

### 2. Same file — Update TOOL_SCHEMA description

Update the `overall_score` description from the current generic text to reference the scoring bands and penalty rules, reinforcing the prompt constraints in the schema itself.

### 3. Same file — Lower temperature

Drop from `0.3` to `0.2` for more deterministic, less generous scoring.

### 4. Future enhancement (not in this PR)

The user's suggestion about structured `must_have_requirements`, `nice_to_have_requirements`, and `dealbreakers` fields on the job is excellent. That would require a schema addition to the `jobs` table and UI to manage them. Worth doing as a follow-up — for now the model infers these from the job description text.

## Files

| File | Change |
|------|--------|
| `supabase/functions/analyze-candidate-fit/index.ts` | Replace SYSTEM_PROMPT with rigorous version; update tool schema description; lower temperature to 0.2 |

