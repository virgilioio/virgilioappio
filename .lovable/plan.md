

# Fix PDL Location Filtering

## Problem
PDL searches with location always return 0 results and fall back to `titles_only`, returning global (mostly USA) candidates.

**Root cause**: The frontend sends locations using ISO-2 country codes (e.g. `"MX"`, `"CO"`, `"AR"`) or formatted strings like `"Mexico City,Mexico City,MX"`. The `locationClauses` function lowercases these directly (`"mx"`, `"co"`), but PDL expects **full lowercase country names** like `"mexico"`, `"colombia"`, `"argentina"`.

Confirmed by logs:
```
PDL attempt [titles+location]: {"term":{"location_country":"mx"}}  → 0 results
PDL attempt [titles_only]: ...                                      → 5 results (global)
```

PDL docs confirm: `{"term": {"location_country": "mexico"}}` is the correct format.

## Fix

**File**: `supabase/functions/search-pdl-candidates/index.ts`

1. Add an ISO-2 to PDL country name mapping (covers all countries in `LOCATION_OPTIONS` and `REGION_TO_COUNTRY_CODES`)
2. Update `locationClauses` to convert country codes to full lowercase names before building the query
3. For city/state values, lowercase them for PDL's `location_locality` and `location_region` fields (these already use human-readable names like "Mexico City")

**Example transform**:
- Input: `["MX", "Mexico City,Mexico City,MX"]`
- Output query: `{"bool":{"should":[{"term":{"location_country":"mexico"}},{"bool":{"must":[{"term":{"location_locality":"mexico city"}},{"term":{"location_country":"mexico"}}]}}]}}`

4. Redeploy `search-pdl-candidates` function

## Scope
- Single file change: `supabase/functions/search-pdl-candidates/index.ts`
- No frontend changes needed — the location data format stays the same
- No database changes needed

