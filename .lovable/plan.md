

## Fix: Respect Explicit Country Mentions Instead of Generalizing to Regions

### Problem
When a JD explicitly states "India or the Philippines," the AI generalizes this to `region: "APAC"`, which then gets expanded to 12 APAC countries (China, Japan, Singapore, Australia, etc.). The user gets candidates from countries they never asked for.

### Root Cause
The `location_details` schema only has a single `country_code` field. When 2+ countries are mentioned, the AI cannot express them individually, so it generalizes to a region. The frontend then blindly expands the region to ALL member countries.

### Solution

**1. Update the AI prompt to extract specific countries** (`supabase/functions/generate-job-spec/index.ts`)

Add a `country_codes` array field to the `location_details` JSON schema in the system prompt. Add an explicit instruction:

```
CRITICAL LOCATION GROUNDING RULE:
If the job description or prompt explicitly names specific countries (e.g., "India or the Philippines"),
you MUST list ONLY those countries in country_codes. Do NOT generalize to a region.
Only use region when the prompt itself uses regional language ("LATAM", "APAC", "Europe", etc.)
or gives no specific country constraints.
```

Update the expected JSON output to include:
```json
"location_details": {
  "country_codes": ["IN", "PH"],
  "region": null,
  "is_remote": true
}
```

**2. Update frontend location processing** (`src/components/dashboard/AIJobAssistant.tsx`, lines 337-367)

Change the location normalization logic to check for `country_codes` (plural) first:

```
Priority order:
1. If location_details.country_codes exists and has entries -> use those directly
2. If location_details.country_code exists (single, legacy) -> use that
3. If location_details.region + is_remote -> expand region (existing behavior)
4. Fall back to normalizeLocationForSourcing(rawLocation)
```

**3. Update TypeScript types** (`src/types/sourcing.ts`)

Add `country_codes?: string[]` to the `location_details` type definition so the new field is properly typed.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-job-spec/index.ts` | Add grounding rule to prompt; add `country_codes` array to expected JSON schema |
| `src/components/dashboard/AIJobAssistant.tsx` | Add `country_codes` check before region expansion (lines 337-367) |
| `src/types/sourcing.ts` | Add `country_codes?: string[]` to `location_details` type |

### Why This Works
- When the JD says "India or Philippines," the AI returns `country_codes: ["IN", "PH"]` instead of `region: "APAC"`
- The frontend uses those exact codes -- no expansion to unwanted countries
- When the prompt genuinely says "APAC" or "remote globally," the existing region expansion still works
- The grounding rule in the prompt enforces: explicit mentions override inference

### Edge Cases Handled
- JD says "India or Philippines" -> `country_codes: ["IN", "PH"]` (exact match)
- JD says "APAC region" -> `region: "APAC"` (region expansion, as before)
- JD says "Remote" with no location -> global search (as before)
- JD says "Mexico City" -> single city match via existing `country_code` path
- Legacy responses without `country_codes` -> fall through to existing logic (backward compatible)
