

## Fix: Add Missing Countries to Apollo Edge Function

### Problem
We added ~90 countries to the location selector, but the `COUNTRY_CODE_TO_NAME` map in the Apollo search edge function only covers ~40 of them. When a user selects a country like "Czech Republic" or "Israel", the code sends the raw code (`CZ`, `IL`) to Apollo instead of the full name -- Apollo won't return correct results.

### Solution
Expand the `COUNTRY_CODE_TO_NAME` map in `supabase/functions/search-apollo-candidates/index.ts` to include all countries available in the location selector.

### Changes

**File: `supabase/functions/search-apollo-candidates/index.ts`** (lines 81-94)

Add the following country codes to the existing `COUNTRY_CODE_TO_NAME` map:

**Europe (missing):** CZ: Czech Republic, RO: Romania, HU: Hungary, UA: Ukraine, HR: Croatia, SK: Slovakia, SI: Slovenia, BG: Bulgaria, LT: Lithuania, LV: Latvia, EE: Estonia, LU: Luxembourg, IS: Iceland

**Asia-Pacific (missing):** TW: Taiwan, HK: Hong Kong, PK: Pakistan, BD: Bangladesh, LK: Sri Lanka, NP: Nepal

**Middle East (missing):** IL: Israel, QA: Qatar, BH: Bahrain, KW: Kuwait, OM: Oman, JO: Jordan, LB: Lebanon, TR: Turkey

**Africa (missing):** GH: Ghana, MA: Morocco, TN: Tunisia, ET: Ethiopia, TZ: Tanzania, RW: Rwanda

**Caribbean (missing):** JM: Jamaica, TT: Trinidad and Tobago, PR: Puerto Rico

### No Other Files Changed
The rest of the pipeline (location selector, search criteria storage, Apollo API call construction) already works correctly. This is purely filling the gap in the country-code-to-name lookup so Apollo receives human-readable country names instead of raw ISO codes.

