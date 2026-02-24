

# Fix: Chrome Extension "Fetch Contact" 502 Error

## Root Cause
The edge function logs show the exact error from the enrichment provider:

```
400 {"error":"Please add a valid 'webhook_url' parameter when using 'reveal_phone_number'"}
```

The `handleEnrich` function in `chrome-api-gateway` sends `reveal_phone_number: true` in the API request, but does not include the required `webhook_url` parameter. The provider rejects the request with a 400, which the gateway forwards as a 502 to the extension.

## Fix
**File:** `supabase/functions/chrome-api-gateway/index.ts` (line 835)

Remove `reveal_phone_number: true` from the request body. The Chrome extension enrichment flow only needs email and basic phone data (which are returned by default without the phone reveal flag). The `reveal_phone_number` option is an async flow that requires a webhook callback -- overkill for this use case.

**Before:**
```typescript
body: JSON.stringify({
  details: [{ linkedin_url }],
  reveal_phone_number: true,
})
```

**After:**
```typescript
body: JSON.stringify({
  details: [{ linkedin_url }],
})
```

This is a one-line removal. The enrichment provider already returns any available phone numbers in its standard response -- the `reveal_phone_number` flag is only needed for requesting additional phone number discovery via webhook, which isn't relevant for the extension's "populate form fields" use case.

## No Other Changes Needed
The rest of the handler (credit checks, response parsing, error handling) is correct. This single line was causing the 400 rejection.
