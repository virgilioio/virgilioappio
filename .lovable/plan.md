

# Fix Cross-Language Keyword Matching

## Root Cause (Mónica's case)

Three compounding failures produce the 34% score:

1. **Title keyword is a single long Spanish phrase**: `["Coordinación de Cuentas por Pagar"]`. Mónica's role is `"ANALISTA DE CUENTAS POR PAGAR"` — the substring `"coordinación de cuentas por pagar"` doesn't exist in her corpus, so title match = 0 (loses 40% of score).

2. **No cross-language synonyms**: The `standard_job_titles` table has no entry for this role. No English equivalents like "Accounts Payable Coordinator" are generated, even though her `standardized_title` is `"Accounts Payable Analyst"`.

3. **Domain keywords are Spanish-only**: `["Cuentas por Pagar", "Flujo de efectivo", "Conciliaciones", ...]`. An English resume with "Cash Flow", "Reconciliations", "Budget Control" would match zero keywords.

## Solution: Bilingual Keyword Generation + Smarter Title Matching

### 1. `supabase/functions/generate-comprehensive-skills/index.ts` — Bilingual keywords

**`getTitleKeywords()`** — after fetching from `standard_job_titles`, add an AI micro-call to generate cross-language synonyms:
- Input: the job title
- Output: title in both English and Spanish/Portuguese + common abbreviations
- Example: `"Coordinación de Cuentas por Pagar"` → `["Coordinación de Cuentas por Pagar", "Cuentas por Pagar", "Accounts Payable Coordinator", "Accounts Payable", "AP Coordinator"]`
- Also split compound titles to include core fragments (e.g., "Cuentas por Pagar" extracted from the full phrase)

**`extractDomainKeywords()`** — update the system prompt to explicitly require bilingual output:
- Each concept should appear in both the source language AND English
- Example: `["Cuentas por Pagar", "Accounts Payable", "Flujo de efectivo", "Cash Flow", "Conciliaciones", "Reconciliations", "ERP", "Excel"]`
- Cap still at 8 concepts (up to ~16 strings since each concept has two language variants)

### 2. `supabase/functions/_shared/keywordScoring.ts` — Smarter title matching

Current code does `corpus.includes(kw.toLowerCase())` which requires the entire phrase as an exact substring. Change to:
- For multi-word title keywords (3+ words), also try matching the **core noun phrase** — split on common prefixes like "Coordinación de", "Gerente de", "Director de", "Manager of", "Head of" and match the remainder
- This way `"Cuentas por Pagar"` matches even when the full phrase `"Coordinación de Cuentas por Pagar"` doesn't appear

### 3. Update `PriorityKeywords` interface

No schema change needed — `title_keywords` and `domain_keywords` are already string arrays stored in jsonb. They'll just contain more entries (bilingual).

### 4. Backfill existing jobs

Add a note in the UI or a manual trigger: when a job's `priority_keywords` are regenerated (via the Generate button), the new bilingual logic kicks in automatically. No migration needed — existing keywords work, they'll just be more comprehensive after regeneration.

## Files

| File | Change |
|------|--------|
| `supabase/functions/generate-comprehensive-skills/index.ts` | Bilingual title synonyms via AI micro-call; bilingual domain keyword prompt |
| `supabase/functions/_shared/keywordScoring.ts` | Core noun phrase extraction for multi-word title keywords |

