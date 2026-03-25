

# Fix Chrome Extension Contact Enrichment

## Problem

Two issues identified:

### 1. Apollo API Error (this project)
The `chrome-api-gateway` edge function calls Apollo's `bulk_match` API with `reveal_phone_number: true` but **without a `webhook_url`**. Apollo now requires a valid webhook URL when phone reveal is enabled.

Error from logs:
```
❌ Enrichment API error: 400 {"error":"Please add a valid 'webhook_url' parameter when using 'reveal_phone_number'"}
```

The `enrich-by-linkedin` function already does this correctly (line 178), but the gateway doesn't.

### 2. Contact Info Dialog (Chrome extension project)
The "Contact Info" fetch is an inline button handler in `CandidateForm.tsx` — not a modal dialog. It doesn't auto-close because there's nothing to close. This is expected behavior. If you want auto-close behavior, that would be a change in the [Chrome Helper Hub](/projects/0dd6103b-040c-463c-8357-f544b2f5ad1c) project.

## Fix

**File: `supabase/functions/chrome-api-gateway/index.ts`** (lines 853-865)

Add `webhook_url` to the Apollo `bulk_match` call, matching the pattern from `enrich-by-linkedin`:

```typescript
const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/apollo-phone-webhook`;

const enrichResponse = await fetch(APOLLO_BULK_MATCH_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'X-Api-Key': APOLLO_API_KEY
  },
  body: JSON.stringify({
    details: [{ linkedin_url }],
    reveal_phone_number: true,
    webhook_url: webhookUrl
  })
});
```

One line added. Then redeploy the edge function.

## What stays untouched
- `enrich-by-linkedin` — already correct
- `apollo-phone-webhook` — already handles incoming phone data
- Chrome extension code — no changes needed in this project

