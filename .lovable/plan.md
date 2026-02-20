
## Root Cause: Service Role Client Strips `auth.uid()` Context

### What Is Happening

The edge function passes the authorization check at the HTTP layer (JWT metadata confirms `platform_admin`), but then calls the SQL RPC functions (`admin_delete_candidate`, `admin_delete_job`, etc.) using the **service role client**.

When Postgres runs under the service role, `auth.uid()` returns `NULL`. The `is_platform_admin()` function relies on `auth.uid()` to look up the caller in the `members` table. With no UID, it always returns `false`, causing every admin RPC to raise:

```
Unauthorized: Only platform admins can delete candidates via this function
```

This is why the edge function log shows the authorization check passing (the "Admin operation requested by user" log line appears), but the database call then fails.

### The Fix

Switch all four RPC calls in the edge function from the **service role client** to the **user JWT client** (`supabaseAuth`). Since `supabaseAuth` was created with the user's `Authorization` header, Postgres will see the correct `auth.uid()` when executing the SQL functions, and `is_platform_admin()` will correctly return `true`.

The `SECURITY DEFINER` attribute on the SQL functions means they already run with elevated database privileges (owner permissions) — using the user JWT to call them does not reduce their power. It only restores the `auth.uid()` session context that the functions need for their internal authorization check.

### Technical Details

| Client | `auth.uid()` in DB session | Outcome |
|---|---|---|
| Service role (`supabaseClient`) | `NULL` | `is_platform_admin()` → `false` → RAISE EXCEPTION |
| User JWT (`supabaseAuth`) | Caller's UUID | `is_platform_admin()` → `true` → Success |

### Files Changed

**`supabase/functions/admin-operations/index.ts`**

Replace the four `supabaseClient.rpc(...)` calls with `supabaseAuth.rpc(...)`:

- `admin_delete_job` → called via `supabaseAuth`
- `admin_delete_candidate` → called via `supabaseAuth`
- `admin_manage_member` → called via `supabaseAuth`
- `admin_manage_organization` → called via `supabaseAuth`

The service role client (`supabaseClient`) is removed entirely since it is no longer needed in this function.

No database migrations are required. No other files need to change.
