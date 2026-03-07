

# Add Location Extraction to Enrichment Pipeline

## Problem
The `enrich-candidate-profile` edge function extracts 30+ fields but **does not** extract candidate-level location (`location_country`, `location_city`, `location_state`). Location is only captured per work experience entry. Candidates imported via CSV or batch-enriched end up with empty location fields even when the resume contains this data.

## Changes

### File: `supabase/functions/enrich-candidate-profile/index.ts`

1. **Add 3 location fields to the OpenAI tool schema** (`EXTRACTION_TOOL.parameters.properties`):
   - `location_country` — Country of residence (e.g. "Mexico", "United States")
   - `location_state` — State/province (e.g. "Jalisco", "California")  
   - `location_city` — City (e.g. "Guadalajara", "San Francisco")

2. **Add extraction guidance to `SYSTEM_PROMPT`**:
   - Instruct the AI to infer the candidate's current location from the most recent work experience, address header, or other resume signals.

3. **Map extracted location fields into the `candidateUpdate` object** (around line 304):
   - `location_country: extracted.location_country || null`
   - `location_state: extracted.location_state || null`
   - `location_city: extracted.location_city || null`
   - The existing database trigger (`normalize_candidate_location`) will automatically canonicalize these values on UPDATE.

No database migration needed — the columns already exist. No changes to `batch-re-enrich` needed — it delegates to this function. Both batch and 1-by-1 flows will benefit.

