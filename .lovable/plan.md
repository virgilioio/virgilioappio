

# Fix: SaaS Admin Actions (Change Plan, Suspend, etc.) Failing Silently

## Root Cause

The `admin-manage-subscription` edge function tries to write `suspended_at` and `suspended_reason` columns to the `tenant_subscriptions` table — but **those columns don't exist there**. They exist on the `organizations` table instead.

When the function runs `suspend` or `restore`, the Supabase update silently fails or ignores the unknown columns, so nothing actually changes.

Specifically:
- **Suspend**: Sets `billing_status`, `suspended_at`, `suspended_reason` on `tenant_subscriptions` — last two columns don't exist → update may fail
- **Restore**: Tries to null out `suspended_at`, `suspended_reason` — same issue
- **Activate**: Same issue with those columns

## Fix

Add `suspended_at` (TIMESTAMPTZ) and `suspended_reason` (TEXT) columns to the `tenant_subscriptions` table via a migration. This is the correct location since all the subscription management logic operates on this table.

The `organizations` table already has these columns from a previous migration, but the edge function doesn't use that table for suspend/restore — it only uses `tenant_subscriptions`. Adding the columns to `tenant_subscriptions` makes the existing edge function code work correctly without any code changes.

## Files changed

| File | Change |
|------|--------|
| DB migration | `ALTER TABLE tenant_subscriptions ADD COLUMN suspended_at TIMESTAMPTZ, ADD COLUMN suspended_reason TEXT` |

