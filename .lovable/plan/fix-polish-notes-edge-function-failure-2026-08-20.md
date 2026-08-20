# Fix "Polish notes" edge function failure

## What's happening

Clicking "Polish notes" fails with `FunctionsFetchError: Failed to send a request to the Edge Function`. That generic client error is a symptom: the function never gets to run.

The `polish-scorecard-notes` logs show the function crashing at boot on every invocation:

```text
module "/bufferutil@4.1.0/denonext/package.json" not found
module "node:url" not found
event loop error: TypeError: Cannot destructure property 'URL' of 'p(...)' as it is null.
    at https://esm.sh/ws@8.21.3/denonext/ws.mjs
```

The function imports `https://esm.sh/@supabase/supabase-js@2.50.0`, and that esm.sh build pulls in the `ws` websocket package, which fails to resolve `node:url` in the current Deno runtime. The module blows up before the request handler is reached, so no response (and no CORS headers) ever comes back.

## The fix

In `supabase/functions/polish-scorecard-notes/index.ts`:

- Replace the esm.sh Supabase import with the Deno-native `npm:@supabase/supabase-js@2` specifier (the pattern already used by the chat functions in `_shared/`), which avoids the broken `ws` build.
- Drop the unused legacy `https://deno.land/x/xhr@0.1.0/mod.ts` import.
- Keep CORS handling, but ensure the OPTIONS preflight and all responses return the headers as they do today.

No changes to the prompt, model, request/response shape, or any client code — the polish behavior stays identical.

## Verification

After deploy, trigger "Polish notes" from a scorecard and confirm the function logs show a normal boot plus the existing `Calling OpenAI API...` / `Polish notes successful` lines, and the editor receives polished text.
