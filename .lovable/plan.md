

# Add Anti-Hallucination Rules to AI Fit Analysis Prompt

## What changes

Insert the user's finalized anti-hallucination rules into the `SYSTEM_PROMPT` in `supabase/functions/analyze-candidate-fit/index.ts`, and tighten the Salary Alignment dimension description.

## Implementation

**File**: `supabase/functions/analyze-candidate-fit/index.ts`

### 1. Insert anti-hallucination block after CRITICAL RULES (after line 111)

Add a new `ANTI-HALLUCINATION RULES` section with the user's exact 8 rules:

1. Never claim a job requires something unless explicitly stated in the job description
2. Never claim a candidate lacks something unless candidate data explicitly confirms absence — "not mentioned" means unknown, not absent
3. Missing information on either side = "unknown" / "not provided" — never convert into a penalty unless explicit contradictory evidence exists
4. Education penalty only if job explicitly requires a degree AND candidate data confirms they don't have it
5. Never misstate salary figures — use exact numeric values, no paraphrasing or rounding
6. Salary alignment: within posted range or ±25% of job max = negotiable, no penalty. Only flag >25% above job max. Missing salary data = null dimension
7. Every gap/mismatch must explicitly reference (a) the exact job requirement/datum and (b) the exact candidate datum or state data is unavailable
8. When evidence is ambiguous, incomplete, or missing, prefer a neutral assessment over a negative inference

### 2. Replace Salary Alignment dimension description (line 139)

Replace:
```
- Salary Alignment (weight ~10): Compare candidate salary expectations vs job range. null if unknown.
```

With:
```
- Salary Alignment (weight ~10): Compare using exact numeric values only. Do not approximate or paraphrase salary figures. If candidate expected salary is within ±25% of the job max or within the posted range, treat it as negotiable and do not penalize. Only flag a mismatch when the candidate expectation is more than 25% above the job maximum. If salary data is missing on either side, return null for this dimension and do not infer a mismatch.
```

### 3. Deploy edge function

Deploy the updated `analyze-candidate-fit` function.

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/analyze-candidate-fit/index.ts` | Add 8 anti-hallucination rules + tighten salary dimension wording |

