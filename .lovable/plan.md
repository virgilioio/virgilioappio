

# Fix PDL Search Query — Invalid Query Format

## Problem

The `search-pdl-candidates` function is sending ElasticSearch-style `match` queries with `fuzziness: 'AUTO'`, but PDL's Person Search API doesn't support that syntax. PDL returns 400: `"Query clause [query] not allowed or invalid field name."` Every search gets 0 PDL results.

## Root Cause

PDL's search endpoint uses a **simplified SQL-like query string**, not raw ElasticSearch JSON. The `buildPdlQuery` function builds nested `bool/must/should/match` objects which PDL rejects.

## Fix

Rewrite `buildPdlQuery` in `supabase/functions/search-pdl-candidates/index.ts` to use PDL's actual query format:

```json
{
  "query": {
    "bool": {
      "must": [
        { "term": { "job_title": "Software Engineer" } }
      ]
    }
  }
}
```

PDL supports `term` (exact) and `match` (simple string, NO `query`/`fuzziness` sub-object). The fix:

- Replace `{ match: { field: { query: "val", fuzziness: "AUTO" } } }` with `{ term: { field: "val" } }` for all fields (`job_title`, `location_country`, `skills`, `job_company_name`)
- This uses PDL's supported `term` clause which does case-insensitive matching

Also: return a 200 with empty results on 400/500 errors instead of throwing (graceful fallback so Apollo results still show).

## Files

| File | Action |
|------|--------|
| `supabase/functions/search-pdl-candidates/index.ts` | **Edit** — rewrite `buildPdlQuery` to use `term` instead of `match` with `fuzziness` |

## Single change, deploy, test.

