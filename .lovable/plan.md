
## Root Cause: Two Conflicting `accept_invitation` Functions Exist in the Database

### What Is Happening

The database currently has **two overloaded versions** of `accept_invitation`:

| Signature | Source |
|---|---|
| `accept_invitation(token_input UUID, new_user_id UUID)` | Original — the correct, long-standing version |
| `accept_invitation(token_input TEXT, new_user_id UUID)` | Created by migration `20260119234801` — the rogue duplicate |

When the edge function `accept-invitation-with-metadata` calls `supabase.rpc('accept_invitation', { token_input: token, ... })`, PostgREST receives a string value for `token_input`. Because both function signatures exist, it cannot determine which overload to call and returns error code **PGRST203**:

```
Could not choose the best candidate function between:
  public.accept_invitation(token_input => text, new_user_id => uuid)
  public.accept_invitation(token_input => uuid, new_user_id => uuid)
```

This means **every single invitation acceptance is broken** — including `malena@virgilio.tech`, who has been attempting it 5+ times in the last 10 minutes (all visible in the logs).

### The Fix

A single SQL migration to drop the rogue `TEXT` version of the function. The `UUID` version (the original, correct one) handles everything correctly — it already casts `token_input` to UUID internally and does row-level locking, retry logic, and proper validation.

```sql
DROP FUNCTION IF EXISTS public.accept_invitation(token_input text, new_user_id uuid);
```

That is the entire fix. No code changes needed in the edge function — it already passes the token as a string which PostgREST will correctly cast to UUID once the ambiguity is gone.

### Why This Happened

Migration `20260119234801` was originally intended to switch from `UUID` to `TEXT` input (so the token could be passed as a plain string). It included a `DROP` of the text version at the top — but then recreated a `TEXT` version below, and the original `UUID` version was never dropped. The result: both live in the database simultaneously.

### Files Changed

- **One database migration** — `DROP FUNCTION IF EXISTS public.accept_invitation(token_input text, new_user_id uuid)` only. No edge function changes. No frontend changes.

### Verification

After the migration runs, `malena@virgilio.tech` (and all future invitees) will be able to accept their invitations without errors. The edge function needs no changes — it already works correctly once the ambiguity is resolved.
