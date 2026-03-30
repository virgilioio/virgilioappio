

# Fix: Old Virgilio Domain Still Used as Email Sender

## Root cause

Yes — this is exactly what's breaking invitations. The Supabase Auth SMTP configuration is still sending from `noreply@app.virgilio.io`, but your mail provider (Resend) only has `gogio.io` verified. Resend rejects every email with `550 The associated domain with your API key is not verified`.

## Two things to fix

### 1. Supabase Dashboard — SMTP sender address (YOU must do this)

This is **not** a code change — it's a configuration change in your Supabase project:

1. Go to **Supabase Dashboard → Authentication → Email Templates → SMTP Settings**
2. Change the **Sender email** from `noreply@app.virgilio.io` to `noreply@app.gogio.io`
3. Save

This unblocks all Auth emails: signup confirmations, password resets, magic links, and invitation signups.

### 2. Code fix — hardcoded old domain in `create-booking`

**File**: `supabase/functions/create-booking/index.ts` (line 744)

Change `noreply@virgilio.tech` → `noreply@app.gogio.io` so booking notification emails also send from the correct domain.

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/create-booking/index.ts` | Replace `noreply@virgilio.tech` with `noreply@app.gogio.io` |
| **Supabase Dashboard** (manual) | Update SMTP sender from `virgilio.io` to `gogio.io` |

