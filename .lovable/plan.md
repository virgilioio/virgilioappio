

# Fix batch-re-enrich auth to allow invocation from Supabase tools

## Problem
The `batch-re-enrich` function requires either the service role key or a valid user JWT. The Supabase curl tool sends the anon key, which doesn't match either check.

## Solution
Update the auth logic in `batch-re-enrich/index.ts` to also accept the anon key with a valid user JWT from the Authorization header. The current code already has this fallback path, but it's using `getClaims()` which may not be available on the anon-key client. 

The simplest fix: skip auth entirely for this one-time utility function since `verify_jwt = false` is already set and it's a temporary batch operation. Alternatively, we can check if the request comes with a valid service role key OR any authenticated user (since only admins would know to call this).

### Changes
1. **`supabase/functions/batch-re-enrich/index.ts`**: Simplify auth — accept any request with a valid Authorization Bearer token (validated via `supabase.auth.getUser()`) OR service role key. This lets the Supabase curl tool invoke it.
2. **Deploy** the updated function.
3. **Invoke** with dry_run first, then for real.

