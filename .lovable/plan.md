## Problem

`grant_access` returns `{ error: "Invalid action" }` even though the source file in `supabase/functions/admin-manage-subscription/index.ts` clearly handles that case (lines 221–286). The edge function logs confirm this: after `Managing subscription: { action: "grant_access", ... }` there is no `[grant_access] entering` log line, which means the running deployment falls straight through the switch to the default `Invalid action` branch.

Conclusion: the live deployment is stale — the previous edit to the function didn't actually reach the runtime.

## Fix

1. Force a redeploy of the `admin-manage-subscription` edge function so the current source (with the `grant_access` and `revoke_access` cases plus the new detailed logging) goes live.
2. Re-test "Grant Temporary Access" from `/settings/platform/saas-customers/...` and confirm:
   - Edge function logs show `[grant_access] entering` → `[grant_access] inserting grant row` → `[grant_access] grant row created <id>`.
   - A new row appears in `tenant_access_grants`.
   - The UI toast shows success.
3. If the call still fails, read the now-detailed error body (already wired through `readFunctionsErrorBody` in `useSaaSAdminActions.ts`) to pinpoint the real DB/permission cause and fix from there.

## Out of scope (separate pre-existing bugs)

- `GET /rest/v1/profiles?select=id,full_name,email...` 400 — `profiles` has `user_id`, `first_name`, `last_name`, not `id`/`full_name`. Lives in `PlatformCustomers.tsx`.
- `usePlatformMetrics` `Failed to fetch` — transient network/CORS to `platform-admin-metrics`.

These are unrelated to the grant-access failure and should be tracked separately.