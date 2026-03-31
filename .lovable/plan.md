
# Fix invitation signup failure: separate Auth email config from app email config

## What I found

This is still not an RLS problem, and not the `accept-invitation-with-metadata` step.

The actual failure happens earlier at:

```text
POST /signup → 500 Error sending confirmation email
```

The auth logs confirm the same error twice today for different users:

```text
gomail: could not send email 1: 550 The associated domain with your API key is not verified.
Please, create a new API key with full access or with a verified domain.
```

## Important clarification

Your custom invitation emails can still be sending correctly from `gogio.io` while invited-user signup still fails.

Why:

- `send-invitation` uses the project Edge Function secret `RESEND_API_KEY`
- `AcceptInvite.tsx` creates the account with `supabase.auth.signUp(...)`
- that signup triggers **Supabase Auth’s own email sender / SMTP configuration**
- the failing API key is therefore the one configured in **Supabase Auth SMTP settings**, which is separate from the key your invitation Edge Function uses

So this explains the contradiction:
- invite email arrives fine
- user clicks invite
- account creation fails on `/signup`
- they see “Failed to accept invitation”

## Root cause

Supabase Auth is configured with a Resend/API key that is not authorized for the sender domain being used for confirmation emails.

Even if the visible sender is already `noreply@app.gogio.io`, the underlying API key configured in Supabase Auth is still wrong / scoped incorrectly / not full-access.

## Fix plan

### 1. Fix the actual infrastructure issue in Supabase Auth
In Supabase Dashboard:

```text
Authentication → Email Templates / SMTP Settings
```

Update the SMTP/API credentials used by Supabase Auth:
- replace the current Resend key with a **Full Access** key, or
- use a key explicitly authorized for `app.gogio.io` / `gogio.io`

Also verify the sender address there matches:
```text
noreply@app.gogio.io
```

This is the real unblocker.

### 2. Improve the invite acceptance UI error
Update `src/pages/AcceptInvite.tsx` so when signup fails with:
- `Error sending confirmation email`
- `associated domain with your API key is not verified`
- generic `/signup` 500 from Auth

the user sees a precise message instead of the misleading:
```text
Failed to accept invitation. Please try again.
```

Use wording like:
```text
We couldn’t finish account setup because confirmation emails are temporarily unavailable. Please contact your administrator.
```

### 3. Optional hardening
Also update normal signup handling (`src/contexts/AuthContext.tsx` or `src/pages/SignUp.tsx`) so the same infrastructure error is surfaced clearly outside the invite flow.

## Files to update

| File | Change |
|---|---|
| `src/pages/AcceptInvite.tsx` | Add specific handling for Auth email-sending failures during `signUp` |
| `src/contexts/AuthContext.tsx` or `src/pages/SignUp.tsx` | Optionally surface the same SMTP/Auth error more clearly for regular signup |

## Notes

- No evidence points to `accept-invitation-with-metadata` being the failing step
- No evidence points to members-table RLS blocking invited users
- `send-confirmation-email` Edge Function exists in the repo, but the current auth logs show Supabase Auth itself is still trying and failing to send the confirmation email during `/signup`

## Recommended implementation order

1. Correct Supabase Auth SMTP/API key in dashboard
2. Patch `AcceptInvite.tsx` error handling
3. Patch regular signup error handling for consistency
4. Re-test invited-user signup end to end
