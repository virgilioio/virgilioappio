# CoreSignal API Path Correction

## Summary
Updated the default ES-DSL preview endpoint path to remove the deprecated `cdapi` segment.

## Changes Made

### 1. Default Path Updated
**File**: `supabase/functions/sourcing-search/index.ts`

**Before**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/cdapi/v2/employee_base/search/es_dsl/preview'
```

**After**:
```typescript
Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/v2/employee_base/search/es_dsl/preview'
```

### 2. Environment Variables

#### REST Endpoint (Default)
- **Variable**: `CORESIGNAL_PEOPLE_SEARCH_PATH`
- **Default**: `/v1/professional-network/employee/search`
- **Full URL**: `https://api.coresignal.com/v1/professional-network/employee/search`
- **Status**: ✅ No changes needed

#### ES-DSL Preview Endpoint (Feature Flag)
- **Variable**: `CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH`
- **Default**: `/v2/employee_base/search/es_dsl/preview` (corrected)
- **Full URL**: `https://api.coresignal.com/v2/employee_base/search/es_dsl/preview`
- **Feature Flag**: `CORESIGNAL_USE_DSL=true`

### 3. Configuration Verification

#### Checked Files
- ✅ `supabase/functions/sourcing-search/index.ts` - Updated
- ✅ `supabase/functions/sourcing-search/buildFilterPayload.test.ts` - No path references
- ✅ `docs/sourcing-search-implementation-report.md` - Already uses correct REST path
- ✅ `docs/sourcing-foundations-implementation-report.md` - Generic references only
- ✅ `docs/sourcing-ui-search-only-implementation-report.md` - Generic references only

#### No References Found
No configuration files, tests, or documentation contained references to the old `cdapi` path segment.

### 4. URL Building Logic

The function uses normalized URL building with proper slash handling:

```typescript
const base = (Deno.env.get('CORESIGNAL_BASE_URL') ?? 'https://api.coresignal.com').replace(/\/+$/, '');
const useDSL = Deno.env.get('CORESIGNAL_USE_DSL') === 'true';
const path = useDSL
  ? (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH') ?? '/v2/employee_base/search/es_dsl/preview').replace(/^\/+/, '')
  : (Deno.env.get('CORESIGNAL_PEOPLE_SEARCH_PATH') ?? '/v1/professional-network/employee/search').replace(/^\/+/, '');
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

## Migration Notes

### For Existing Deployments
No migration required - the old path was never deployed to production. The default behavior uses the REST endpoint (`/v1/professional-network/employee/search`), which was already correct.

### For Custom Configurations
If you have manually set `CORESIGNAL_PEOPLE_SEARCH_PREVIEW_PATH` in your environment:
- ✅ Keep your custom value
- ⚠️ Remove `cdapi` segment if present
- ✅ Correct format: `/v2/employee_base/search/es_dsl/preview`

## Debug Logging

With `LOG_LEVEL=debug`, the function logs:
- `[CORESIGNAL] Final URL: <full_url>`
- `[CORESIGNAL] Using REST filters endpoint` or `Using ES-DSL endpoint`
- `[CORESIGNAL] Payload: <json>`
- `[CORESIGNAL] Status: <http_status>`
- `[CORESIGNAL] Body (first 500): <response_preview>`

## Status
✅ **Completed** - Default path corrected, no legacy references found
