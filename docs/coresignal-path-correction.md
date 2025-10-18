# CoreSignal API Path Migration to v2

## Summary
Migrated both REST and ES-DSL endpoints to v2 API paths:
- REST endpoint: `/v1/professional-network/employee/search` → `/v2/employee_base/search/filter`
- ES-DSL preview: `/cdapi/v2/employee_base/search/es_dsl/preview` → `/v2/employee_base/search/es_dsl/preview`

## Changes Made

### 1. REST Filter Endpoint (Default)
**File**: `supabase/functions/sourcing-search/index.ts`

**Before**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v1/professional-network/employee/search'
```

**After**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v2/employee_base/search/filter'
```

### 2. ES-DSL Preview Endpoint (Feature Flag)
**File**: `supabase/functions/sourcing-search/index.ts`

**Before**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/cdapi/v2/employee_base/search/es_dsl/preview'
```

**After**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/v2/employee_base/search/es_dsl/preview'
```

### 3. Payload Function Updated
**File**: `supabase/functions/sourcing-search/index.ts`

**Function**: `buildCoreSignalFilterPayload`

Updated documentation to reflect v2 filter endpoint:
```typescript
/**
 * Build CoreSignal REST API filter payload for Base Employee v2 filter endpoint
 * Strips null/empty values and formats for the /v2/employee_base/search/filter endpoint
 */
```

Payload structure remains compatible - v2 filter endpoint uses the same field names:
- `title` (string)
- `keywords` (string[])
- `locations` (string[])
- `languages` (string[])
- `updated_within_days` (integer)
- `page` (integer)
- `page_size` (integer, clamped 1-100)

### 4. Environment Variables

#### REST Filter Endpoint (Default)
- **Variable**: `CORESIGNAL_PEOPLE_SEARCH_PATH`
- **Default**: `/v2/employee_base/search/filter` (updated)
- **Full URL**: `https://api.coresignal.com/v2/employee_base/search/filter`
- **Feature Flag**: None (default behavior)

#### ES-DSL Preview Endpoint (Feature Flag)
- **Variable**: `CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH`
- **Default**: `/v2/employee_base/search/es_dsl/preview` (corrected)
- **Full URL**: `https://api.coresignal.com/v2/employee_base/search/es_dsl/preview`
- **Feature Flag**: `CORESIGNAL_USE_DSL=true`
- **Fallback behavior**: Authentication failures (401/403) automatically fall back to the live DSL endpoint, so keep the preview flag gated to avoid unexpected traffic without explicit opt-in.

### 5. Unit Tests Updated
**File**: `supabase/functions/sourcing-search/buildFilterPayload.test.ts`

- Updated function documentation to reference v2 filter endpoint
- Updated test name: "excludes boolean query (not supported in v2 filter)"
- All payload assertions remain valid (field names unchanged)

### 6. Self-Test Endpoint Updated
The `?self_test=1` endpoint now uses the v2 filter path:
```typescript
const path = (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v2/employee_base/search/filter').replace(/^\/+/, '');
```

### 7. URL Building Logic

The function uses normalized URL building with proper slash handling:

```typescript
const base = (Deno.env.get('CORESIGNAL_BASE_URL') ?? 'https://api.coresignal.com').replace(/\/+$/, '');
const useDSL = Deno.env.get('CORESIGNAL_USE_DSL') === 'true';
const path = useDSL
  ? (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/v2/employee_base/search/es_dsl/preview').replace(/^\/+/, '')
  : (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v2/employee_base/search/filter').replace(/^\/+/, '');
const url = `${base}/${path}`;
```

## Testing Recommendations

### Self-Test Mode (DEV Only)
Run a self-test to verify the REST endpoint (default):
```
GET /sourcing-search?self_test=1
```

This will:
- Send minimal payload: `{"title":"engineer","page":1,"page_size":1}`
- Return provider status and hit count
- Not consume any credits
- Log URL and payload at `LOG_LEVEL=debug`

### ES-DSL Testing
To test the ES-DSL preview endpoint:
1. Set `CORESIGNAL_USE_DSL=true`
2. Set `LOG_LEVEL=debug` to see URL logging
3. Run a search request
4. Verify logs show: `https://api.coresignal.com/v2/employee_base/search/es_dsl/preview`

### REST Filter Testing
Default behavior (no feature flag):
1. Set `LOG_LEVEL=debug` to see URL logging
2. Run a search request
3. Verify logs show: `https://api.coresignal.com/v2/employee_base/search/filter`

## Migration Notes

### For Existing Deployments
**Action Required**: Update any custom `CORESIGNAL_PEOPLE_SEARCH_PATH` environment variables from v1 to v2.

**Before**:
```
CORESIGNAL_PEOPLE_SEARCH_PATH=/v1/professional-network/employee/search
```

**After**:
```
CORESIGNAL_PEOPLE_SEARCH_PATH=/v2/employee_base/search/filter
```

If not set, the default will automatically use the v2 endpoint.

### For Custom Configurations
If you have manually set environment variables:

**REST Path**:
- ⚠️ Update from: `/v1/professional-network/employee/search`
- ✅ Update to: `/v2/employee_base/search/filter`

**ES-DSL Preview Path**:
- ⚠️ Remove `cdapi` segment if present
- ✅ Correct format: `/v2/employee_base/search/es_dsl/preview`

## Debug Logging

With `LOG_LEVEL=debug`, the function logs:
- `[CORESIGNAL] Final URL: <full_url>`
- `[CORESIGNAL] Using REST filters endpoint` or `Using ES-DSL endpoint`
- `[CORESIGNAL] Payload: <json>`
- `[CORESIGNAL] Status: <http_status>`
- `[CORESIGNAL] Body (first 500): <response_preview>`

## Boolean Query Auto-Routing

### New Behavior (Latest Update)
Requests containing `query.boolean` are **automatically** routed through the DSL endpoint, regardless of the `CORESIGNAL_USE_DSL` environment variable.

**Routing Logic:**
```typescript
const hasBooleanQuery = Boolean(query.boolean?.trim());
const useDSL = hasBooleanQuery || Deno.env.get('CORESIGNAL_USE_DSL') === 'true';

const requestPayload = useDSL
  ? buildCoreSignalRequest(query, { page, pageSize })  // DSL builder
  : buildCoreSignalFilterPayload(query, { page, pageSize });  // REST builder
```

**Why This Matters:**
- Boolean queries like `"engineer AND developer"` require the DSL endpoint's boolean parser
- The REST filter endpoint doesn't support boolean query syntax
- This change ensures boolean queries work correctly without requiring environment configuration

### Refactored Flag Handling
- `callCoreSignalAPI` now accepts an explicit `useDSL: boolean` parameter
- Eliminates redundant environment variable reads
- Makes the routing decision explicit and testable

### New Self-Test Mode: `?boolean_test=1`

**Boolean Test (`?boolean_test=1`):**
- Uses DSL endpoint: `/v2/employee_base/search/es_dsl/preview`
- Sends boolean query with nested experience filter:
  ```json
  {
    "query": {
      "bool": {
        "must": [{
          "nested": {
            "path": "experience",
            "query": {
              "bool": {
                "must": [
                  { "match_phrase": { "experience.title": "engineer" } },
                  { "term": { "experience.is_current": 1 } }
                ]
              }
            }
          }
        }]
      }
    },
    "size": 1
  }
  ```
- Tests DSL endpoint functionality without consuming credits
- Returns `test_mode`, `used_dsl`, `provider_status`, and `hit_count`

**Testing Boolean Query Routing:**
```bash
# Test DSL endpoint with boolean query
curl -X POST "https://[project-url]/functions/v1/sourcing-search?boolean_test=1" \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json"

# Or send actual boolean query
curl -X POST "https://[project-url]/functions/v1/sourcing-search" \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "xxx",
    "query": {
      "boolean": "engineer AND developer"
    }
  }'
```

## Status
✅ **Completed** - Both REST and ES-DSL endpoints migrated to v2 paths
- REST filter: `/v2/employee_base/search/filter`
- ES-DSL preview: `/v2/employee_base/search/es_dsl/preview`
- Boolean queries auto-route to DSL endpoint
- Refactored `useDSL` flag handling
- Added `?boolean_test=1` self-test mode
- Unit tests updated with boolean routing tests
- Self-test endpoint updated
- Documentation updated
