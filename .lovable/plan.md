

# Fix: Host Shows as "User" on Public Booking Page

## Root Cause (Confirmed)

The `anon` database role has no `SELECT` grant on the `profiles` table. A previous migration (`20251108`) ran `REVOKE ALL ON public.profiles FROM anon`. A later migration added an RLS policy allowing anon to view profiles of users with active booking configs — but RLS policies don't work without the underlying table grant.

Every unauthenticated visitor (i.e., every candidate) sees "User" with no avatar.

## Fix

One new database migration:

```sql
GRANT SELECT ON public.profiles TO anon;
```

This is safe because the existing RLS policy (`"Public can view profiles for active booking configs"`) already restricts anon access to only profiles where the user has an active `booking_configurations` entry. No other profile data is exposed.

## Files changed

| File | Change |
|------|--------|
| DB migration (new) | `GRANT SELECT ON public.profiles TO anon` |

