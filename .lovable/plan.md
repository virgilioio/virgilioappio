

# Location Data Normalization

## Current Data Quality Issues

Queried the database — the mess is significant:

**Country field** (1,130 candidates):
- `Mexico` (776), `México` (192), `México ` (18 trailing space), `MX` (1), `EEUU` (1)
- Cities stored as country: `Monterrey` (3), `Guadalajara` (1), `Puebla` (1)
- Regions stored as country: `Jalisco, Mexico` (6), `Mexico Metropolitan Area` (4)
- Empty strings (60), `País` (1), `null` string (1)

**State field**:
- `Jalisco` (391), `Jalisco ` (17), `Jal.` (11), `JAL` (7)
- `Nuevo León` (23), `Nuevo Leon` (20), `NL` (2)
- `Mexico City` (344), `CDMX` (18), `Federal District` (19), `Ciudad de México` (12)
- Cities in state: `Monterrey, Nuevo León` (2), `Tonalá, Jalisco` (2)

**City field**:
- `Mexico City` (358), `Ciudad de México` (33), `CDMX` (6), `Ciudad de Mexico` (6), `México City` (2)
- `Área metropolitana de Ciudad de México` (6), `Mexico City Metropolitan Area` (3)

## Solution: Two-Part Approach

### Part 1: One-Time SQL Cleanup (immediate)

Run a SQL migration with UPDATE statements to normalize all existing location data. This handles:

1. **Trim whitespace** on all three fields
2. **Country normalization** — canonical English names:
   - `México`, `México `, `MX` → `Mexico`
   - `EEUU` → `United States`
   - `Perú` → `Peru`
   - `Brasil` → `Brazil`
   - Move cities/states wrongly in country field to correct columns
   - Clear garbage values (`País`, `null` string, empty strings → NULL)

3. **State normalization** — canonical names:
   - `Jal.`, `JAL`, `Jalisco ` → `Jalisco`
   - `NL`, `Nuevo Leon` → `Nuevo León`
   - `CDMX`, `Federal District`, `Ciudad de México`, `Ciudad de Mexico` → `Mexico City` (for state)
   - Strip city names from composite values (`Monterrey, Nuevo León` → state=`Nuevo León`)

4. **City normalization** — canonical names:
   - `Ciudad de México`, `CDMX`, `México City`, `Ciudad de Mexico` → `Mexico City`
   - Strip metro area prefixes (`Área metropolitana de...` → base city)
   - `Santiago de Queretaro` → `Querétaro`
   - `Sao Paulo` → `São Paulo`

### Part 2: Database Trigger for Ongoing Normalization

Create a PostgreSQL trigger function `normalize_candidate_location()` that fires BEFORE INSERT or UPDATE on the `candidates` table. This function will:

1. Trim whitespace
2. Apply the same country/state/city canonical mappings
3. Handle common Spanish↔English variations
4. Normalize accented characters where appropriate
5. Fix known misplacements (city in country field, etc.)

This means **no frontend changes needed** — data gets normalized at the database level regardless of source (Apollo, Chrome extension, public applications, manual entry, enrichment pipeline).

### Part 3: Normalize in Talent Insights Hook (defense in depth)

Add a lightweight client-side normalization in `useTalentInsightsData.ts` using a simple mapping for country names before the `countBy` aggregation. This ensures the dashboard shows clean data even before the migration runs.

## Files

- **SQL Migration**: Cleanup script + trigger function (`normalize_candidate_location`)
- **Modified**: `src/hooks/useTalentInsightsData.ts` — add client-side country normalization map in `countBy` calls

## Why a Trigger Instead of Dropdowns

Dropdowns would require maintaining country→state→city cascading lists for every country. The trigger approach:
- Works transparently for all ingestion points (7+ edge functions)
- No UI changes needed
- Handles Spanish/Portuguese variations automatically
- Easy to extend the mapping table over time

