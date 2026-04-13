

# Fix PDL Location Filtering — ISO-2 Country Code Mapping

## Problem
The `locationClauses` function sends raw ISO-2 codes (e.g. `"mx"`) to PDL, which expects full country names (e.g. `"mexico"`). This causes `titles+location` to always return 0 results, falling back to `titles_only` which ignores location entirely.

## Fix

**File**: `supabase/functions/search-pdl-candidates/index.ts`

1. Add a `COUNTRY_CODE_TO_NAME` mapping object (all ~250 ISO-2 codes → lowercase full names) after the imports
2. Add a helper function `resolveCountryName(code: string): string` that looks up the code and falls back to the raw input
3. Update `locationClauses` to pipe all country values through `resolveCountryName` before building `term` queries — affects the 3-part (city,state,country), 2-part (region,country), and 1-part (country-only) branches
4. Also lowercase city/region values for consistency with PDL's format
5. Deploy the updated edge function

## Technical detail

```typescript
// Before (broken)
{ term: { location_country: parts[2].toLowerCase() } }  // "mx"

// After (fixed)
{ term: { location_country: resolveCountryName(parts[2]) } }  // "mexico"
```

The mapping covers all countries from the existing `COUNTRIES` constant, ensuring every location the frontend can send will be correctly translated for PDL.

