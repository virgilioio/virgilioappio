

# Fix: Redeploy Edge Functions with .limit(2000)

## Problem

The `.limit(2000)` fixes were added to the codebase but the deployed edge functions are still running the old code. The logs confirm this — "Apollo returned 1000 candidates (cached: true)" means the cache query is still hitting Supabase's default 1000-row cap.

This causes collected candidates in the "lost" half (rows 1001–2000) to never get cross-referenced, so they appear as Apollo previews instead of "Internal."

## Fix

Redeploy both edge functions. No code changes needed — the code is already correct.

1. Deploy `search-apollo-candidates`
2. Deploy `sourcing-search`
3. Test by invoking `sourcing-search` for project `663dfa1a-790a-42e0-aa2d-597275eeb4c8` and verifying the Apollo count is ~2000 instead of 1000

