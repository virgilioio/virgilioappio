# Fix candidate search (AI + Boolean error banner)

## Root cause

The `candidates-nl-search` edge function exists in code (`supabase/functions/candidates-nl-search/index.ts`) but was never registered in `supabase/config.toml`, so it isn't deployed. A direct call returns `404 NOT_FOUND` and there are no logs.

This produces two visible symptoms:

1. **Plain-English (AI) search**: clicking "Ask" shows "Failed to send a request to the Edge Function".
2. **Boolean search error banner**: the search bar shares one `error` prop between modes (`src/pages/Candidates.tsx` line 308). When the AI call fails, the banner stays visible while you switch tabs, making Boolean look broken too.

Boolean parsing itself works — the parser in `src/hooks/useCandidateBooleanFilter.ts` handles `AND/OR/NOT`, quotes, parentheses, and falls back to plain substring on parse errors.

## Changes

1. **Register the edge function** in `supabase/config.toml`:
   ```toml
   [functions.candidates-nl-search]
   verify_jwt = true
   ```
   This triggers automatic deployment.

2. **Scope the error banner to the active mode** in `src/pages/Candidates.tsx`:
   - Clear `aiError` whenever `mode` changes or `query` is edited, so a stale AI failure doesn't bleed into Boolean/Everything tabs.

3. **Verify after deploy**:
   - `curl` the function with a sample prompt and confirm 200 + JSON filters.
   - In the preview, run a Boolean query (`Figma AND NOT junior`) and an AI query ("senior product designers in NYC who know Figma") and confirm both work.

## Out of scope

No UI redesign, no parser changes, no filter-context changes.
