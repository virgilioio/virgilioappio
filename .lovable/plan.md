

# Fix: Generate Skills CORS Failure + Skills Display Clarification

## Problem 1: "Generate Skills" button fails with "Failed to fetch"

The `generate-comprehensive-skills` edge function uses static CORS headers (`createSecureCorsHeaders()` at module level, line 9), which resolves to `Access-Control-Allow-Origin: https://app.gogio.io`. When called from the preview domain (`*.lovableproject.com`), the browser blocks the response due to origin mismatch.

All other working edge functions use the dynamic pattern: `const cors = corsHeadersFor(req.headers.get('Origin'))` inside the request handler.

**Fix**: Update `supabase/functions/generate-comprehensive-skills/index.ts`:
- Remove the static `const corsHeaders = createSecureCorsHeaders()` at line 9
- Inside `serve()`, extract the request origin and compute CORS dynamically: `const origin = req.headers.get('Origin') ?? undefined; const corsHeaders = corsHeadersFor(origin);`
- Use `handlePreflight(req)` for the OPTIONS check instead of manual handling
- All response headers already reference `corsHeaders` so they'll pick up the dynamic value

## Problem 2: "Existing skills not showing"

The job being edited (`Coordinación de Cuentas por Pagar`) has `skills: []` in the database — an empty array. The form correctly shows "No skills selected yet." This is expected behavior, not a bug. The skills will show once generated and saved.

## Files

| File | Change |
|------|--------|
| `supabase/functions/generate-comprehensive-skills/index.ts` | Fix CORS to use dynamic origin-based headers |

Deploy the function after the fix and test with curl.

