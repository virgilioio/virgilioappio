

# Show Previously Collected Apollo Candidates as Unblocked

## Problem
Apollo search results always come back with `is_preview: true` and obfuscated names, even when you've already collected (unblocked) those candidates. The sliding sheet shows the full data, but the results list still shows them as blocked.

## Fix

### 1. Cross-reference in `sourcing-search` edge function
After merging PDL and Apollo results, query the `candidates` table for any matching `apollo_id` values. For matches, overlay the collected candidate's real data (full name, email, phone, LinkedIn, location) onto the Apollo result and flip `is_preview` to `false`.

**In `supabase/functions/sourcing-search/index.ts`** (~20 lines added after the merge/dedup block):
- Collect all `apollo_id` values from the deduplicated Apollo results
- Query `candidates` table: `SELECT id, apollo_id, candidate_name, email, phone, linkedin_url, location_city, location_state, location_country, company_current, role_current FROM candidates WHERE apollo_id IN (...) AND apollo_collected_at IS NOT NULL`
- For each match, update the Apollo candidate in the merged list: set `candidate_id`, `candidate_name`/`full_name`, contact fields, `is_preview: false`, `needs_enrichment: false`

### 2. No frontend changes needed
The table already handles the `candidate_id` and `is_preview` flags correctly:
- Line 775: Shows "Collected" badge when `candidate_id` is set
- Line 763: `getDisplayName` uses `full_name` which we'll populate
- Line 824: Contact indicators only show for `!candidate_id` Apollo rows
- Line 679: Selection checkbox disabled for collected candidates

### 3. Redeploy edge function
Deploy the updated `sourcing-search` function.

## Scope
- 1 edge function edit (~20 lines)
- 0 migrations
- 0 frontend changes

