

# Fix: Enforce Null Score for Salary Dimension When Data Is Missing

## Problem
The AI fit analysis for candidate Isaac J gives **Salary Alignment: 100/100** with "Expected salary aligns with job range" — but the candidate has **no salary data** (`salary_amount` is NULL). The AI even correctly lists `salary` in `data_sources_missing`, yet still hallucinated a perfect score.

The prompt already instructs the AI to return `null` for salary when data is missing (line 120, 150), but the LLM ignores it. There is no code-level enforcement after receiving the AI response.

## Fix — 1 file

### `supabase/functions/analyze-candidate-fit/index.ts`

After line 341 (`const analysis = JSON.parse(...)`), add a post-processing guardrail:

```ts
// Enforce null scores for dimensions where data is missing
if (dataMissing.includes('salary') && analysis.dimensions) {
  const salaryDim = analysis.dimensions.find(
    (d: any) => d.name?.toLowerCase().includes('salary')
  );
  if (salaryDim && salaryDim.score !== null) {
    salaryDim.score = null;
    salaryDim.insight = 'No salary data available for this candidate.';
    salaryDim.matches = [];
    salaryDim.gaps = [];
  }
}
```

This ensures that regardless of what the LLM returns, if we **know** salary data is missing (tracked deterministically on lines 239-244), the score is forced to `null`.

Additionally, recalculate `overall_score` excluding null dimensions so the weighted average isn't inflated:

```ts
// Recalculate overall_score excluding null dimensions
if (analysis.dimensions) {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const dim of analysis.dimensions) {
    if (dim.score !== null && dim.score !== undefined) {
      totalWeight += dim.weight || 0;
      weightedSum += (dim.score * (dim.weight || 0));
    }
  }
  if (totalWeight > 0) {
    analysis.overall_score = Math.round(weightedSum / totalWeight);
  }
}
```

## What this fixes
- Salary alignment no longer shows a hallucinated score when candidate has no salary data
- Overall score is recalculated honestly, excluding dimensions with no data
- Pattern is extensible — can add similar guards for education or other missing sources

## Scope
- 1 edge function edit (~20 lines)
- Deploy + test

