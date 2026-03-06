

# Improve enrichment: better prompt + AI-driven title standardization

## Problem
1. **`functional_area` and `specialization`** come back null because the prompt doesn't explicitly instruct the AI to always infer them.
2. **`standardized_title`** relies on a DB lookup against `standard_job_titles`, which fails for non-English titles or titles not in the table. The AI already has full context (job title, company, industry, responsibilities) and can standardize far better than a synonym lookup.

## Solution

### 1. Add `standardized_title` to the OpenAI tool schema
Add a new field to the extraction schema:
```
standardized_title: { type: 'string', description: 'Standardized English job title mapped to a common industry equivalent, e.g. "Ingeniero de Calidad" → "Quality Engineer", "SDR" → "Sales Development Representative"' }
```
Also add it per work experience entry so each position gets a standardized title too.

### 2. Strengthen the system prompt
Add explicit instructions:
- **Always infer** `functional_area` and `specialization` from job titles, responsibilities, and industry context — never leave them empty.
- **Always provide** `standardized_title` — translate non-English titles to their standard English equivalent, expand abbreviations (SDR → Sales Development Representative), and normalize to common industry titles.
- For each work experience entry, also provide a `standardized_title`.

### 3. Use AI-generated standardized title as primary, DB lookup as fallback
In the post-processing logic, use the AI-extracted `standardized_title` first. Only fall back to the DB `standardizeTitle()` lookup if the AI didn't return one (which should be rare with the updated prompt).

### 4. Deploy and re-test
Redeploy `enrich-candidate-profile`, then re-enrich the test candidate to verify all fields populate.

### Files changed
- `supabase/functions/enrich-candidate-profile/index.ts` — schema, prompt, and post-processing logic

