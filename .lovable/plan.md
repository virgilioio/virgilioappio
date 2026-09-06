# Fix "Regenerate" failing on the profile summary

## What's happening

Clicking **Regenerate** calls the profile-enrichment service, and that service is crashing the moment it starts up — before it can read the request. That's why the app shows "Failed to send a request to the Edge Function" instead of a real error.

Its logs confirm it, repeatedly:

```text
module "node:url" not found
event loop error: TypeError: Cannot destructure property 'URL' ... ws.mjs
```

The cause is one of its imported libraries: it pins an older exact version of the Supabase client library that drags in a websocket package the server runtime can't load. Other services in the project import the same library without that exact pin and start up fine.

## The fix

1. In the enrichment service, change the Supabase client import to the runtime-native form (`npm:@supabase/supabase-js@2`) instead of the pinned `esm.sh/...@2.50.0` build. Nothing else in the file changes.
2. Redeploy it and confirm a clean start in the logs (no `node:url` error).
3. Trigger Regenerate for Esme Oropeza and confirm the summary refreshes and the loading bar resolves.
4. Apply the same import change to the other services still pinned to that exact version (8 files total, including `enrich-by-linkedin`, `enrich-apollo-profile`, `batch-re-enrich`) so the same crash can't surface elsewhere.

## Note (no change proposed)

The Regenerate action sends a `force` flag, but the service doesn't read it — enrichment always recomputes and overwrites the summary, so behaviour is already what the button promises. Leaving as is.
