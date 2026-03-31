

# Disable Email Confirmation Entirely

## What changes

### 1. Supabase Dashboard (YOU must do this)
Go to **Authentication → Providers → Email** and turn OFF **"Confirm email"** (or "Enable email confirmations"). This makes all signups immediately active — no confirmation email sent.

### 2. Code cleanup — remove all email verification gates and pages

With confirmation disabled, `email_confirmed_at` is set immediately on signup. All verification UI becomes dead code.

| File | Change |
|------|--------|
| `src/pages/AcceptInvite.tsx` | Remove the `email_confirmed_at` check block (~lines 249-272) that redirects to `/verify-email`. After signup, go straight to dashboard. Remove the SMTP error handling (lines 209-214) since no confirmation email is sent anymore. |
| `src/pages/SignUp.tsx` | Remove SMTP error handling (lines 45-53). Change success message from "Check your email for verification" to "Account created! Redirecting..." and auto-redirect to `/account-setup` or `/dashboard`. |
| `src/pages/AccountSetup.tsx` | Remove `emailVerified` state, the `email_confirmed_at` check (lines 30-36), and the `VerifyEmailPending` conditional render (lines 149-152). Always show the form directly. |
| `src/pages/Onboarding.tsx` | Same as AccountSetup — remove `emailVerified` gate and `VerifyEmailPending` conditional. |
| `src/pages/VerifyEmail.tsx` | Delete this file entirely — no longer needed. |
| `src/components/VerifyEmailPending.tsx` | Delete this file entirely — no longer needed. |
| `src/App.tsx` | Remove the `/verify-email` route (line 89) and its lazy import (line 39). |
| `src/contexts/AuthContext.tsx` | Remove `emailRedirectTo` from `signUp` options (line 90) — no longer relevant. |

### Summary

- **Dashboard**: Disable email confirmation toggle
- **Delete**: 2 files (`VerifyEmail.tsx`, `VerifyEmailPending.tsx`)
- **Simplify**: 5 files (remove verification gates and dead error handling)
- **Result**: Invited users sign up and land in the app immediately. Regular signups work instantly too. Zero SMTP dependency for account creation.

