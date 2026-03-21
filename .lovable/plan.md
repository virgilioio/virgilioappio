

# Fix: get-stripe-prices CORS Failure

Same issue we just fixed on `generate-comprehensive-skills`. The `get-stripe-prices` edge function uses static CORS headers at module level (line 5), which resolve to `Access-Control-Allow-Origin: https://app.gogio.io`. Requests from `*.lovableproject.com` get blocked.

## Change

**`supabase/functions/get-stripe-prices/index.ts`**:
- Remove line 5: `const corsHeaders = createSecureCorsHeaders();`
- Inside `serve()`, compute CORS dynamically from the request origin:
  ```
  const origin = req.headers.get('Origin') ?? undefined;
  const corsHeaders = corsHeadersFor(origin);
  ```
- Replace `handleSecureCorsPreFlight(req, corsHeaders)` with `handlePreflight(req)`
- Update import to use `corsHeadersFor, handlePreflight` instead of the legacy helpers

| File | Change |
|------|--------|
| `supabase/functions/get-stripe-prices/index.ts` | Switch to dynamic origin-based CORS headers |

Deploy and verify after fix.

