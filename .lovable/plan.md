

# Autocomplete for Search Criteria Text Fields

## Approach

Replace the plain `TagInput` component in `FindFilterPanel` with an `AutocompleteTagInput` that queries the existing normalization tables (`standard_job_titles`, `standard_skills`, `standard_locations`) as the user types, showing a dropdown of matching suggestions.

## Data Source

Already in the DB:
- `standard_job_titles` — `canonical_title`, `synonyms` (text[]), `category`, `seniority_level`
- `standard_skills` — `canonical_name`, `synonyms` (text[]), `category`
- `standard_locations` — `canonical_name`, `synonyms` (text[]), `country_code`

Each has a `synonyms` text array, so we can match against both the canonical name AND synonyms for fuzzy-feeling results.

## Changes

### 1. New: `src/hooks/useAutocompleteSearch.ts`

A reusable hook that takes a `table` name ('standard_job_titles' | 'standard_skills' | 'standard_locations'), a `searchTerm`, and returns matching suggestions.

- Uses `supabase.from(table).select(...)` with `.ilike()` on the canonical field
- Also searches synonyms using a Postgres function or textual match
- Debounced (300ms) to avoid hammering the DB on every keystroke
- Returns `{ suggestions: string[], isLoading: boolean }`
- Caches results in a simple Map to avoid re-fetching identical queries

### 2. New component: `AutocompleteTagInput` (inside `FindFilterPanel.tsx` or separate file)

Extends the existing `TagInput` pattern:
- Same Input + Plus button + badge list
- As the user types, a small dropdown (Popover or absolute-positioned div) appears below the input showing matching suggestions
- Each suggestion is clickable — adds it as a tag and clears the input
- Keyboard navigation: arrow keys + Enter to select
- Already-added tags are excluded from suggestions
- Shows category/type as a subtle secondary label (e.g., "Sales Development Representative · Sales")

### 3. `src/components/sourcing/FindFilterPanel.tsx` — Wire up

Replace `TagInput` with `AutocompleteTagInput` for:
- **Job Titles** → queries `standard_job_titles`, display field `canonical_title`
- **Keywords** → queries `standard_skills`, display field `canonical_name`
- **Target Companies** → stays as plain `TagInput` (no normalization table for companies)

Locations already use `LocationSelector`, so no change needed there.

### 4. DB function for synonym search (migration)

Create a small Postgres function to search canonical + synonyms efficiently:

```sql
CREATE OR REPLACE FUNCTION search_standard_terms(
  p_table text, p_query text, p_limit int DEFAULT 10
) RETURNS TABLE(canonical text, category text, match_type text)
```

This searches `canonical_name/title ILIKE '%query%'` OR `ANY(synonyms) ILIKE '%query%'`, ordered by usage_count DESC, limited to 10 results. Single function handles all three tables.

## Files Summary

| File | Action |
|------|--------|
| `src/hooks/useAutocompleteSearch.ts` | New — debounced hook querying normalization tables |
| `src/components/sourcing/FindFilterPanel.tsx` | Replace `TagInput` with `AutocompleteTagInput` for titles + keywords |
| Migration SQL | New function `search_standard_terms` for canonical + synonym matching |

