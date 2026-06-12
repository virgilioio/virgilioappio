## The leak

In `src/App.tsx`, three routes sit **outside** `BillingGuard` so users can always reach billing to recover:

```
/billing                                  → <Settings />
/settings                                 → <Settings />
/settings/platform/saas-customers/:id     → <SaaSCustomerDetail />
```

That intent was right for `payment_pending`/`subscription_ended`, but when a tenant is **locked** the user can still:

- open every Settings tab (Members, Workspace, Integrations, Automations, etc.)
- send member invites and edit workspace data
- land on `/billing` after pressing **Back** in Stripe Checkout and bypass the LockedScreen entirely

That's exactly what you hit.

## Fix

Treat the locked state as a true takeover: when `billing_status === 'locked'`, `/settings` and `/billing` render the `LockedScreen` too — same component, same Subscribe / Update payment / Sign out CTAs already wired up. Stripe's Back button keeps returning to `/billing`, the user just lands back on the LockedScreen instead of a usable Settings shell.

`payment_pending` and `subscription_ended` keep their current `/billing` access, since the user needs to reach the billing portal to fix the card or resubscribe — and those statuses already trigger LockedScreen via `BillingGuard` on all other routes.

Platform admins, members (non-admin), and the SaaS customer detail page (admin-only) stay unaffected.

### Implementation

1. **New tiny wrapper** `src/components/auth/SettingsLockGuard.tsx`
   - Reuses `useAuth` + `useBillingStatus` (same pattern as `BillingGuard`).
   - Bypass for `userType === 'platform_admin'` and `memberRole === 'member'`.
   - If `billing_status === 'locked'` → `return <LockedScreen status="locked" />`.
   - Otherwise `<Outlet />` (so `/billing` and `/settings` keep working for trialing / grace / past_due / canceled).

2. **`src/App.tsx`** — wrap the three "always accessible" routes:
   ```tsx
   <Route element={<SettingsLockGuard />}>
     <Route path="/billing" element={<Settings />} />
     <Route path="/settings" element={<Settings />} />
     <Route path="/settings/platform/saas-customers/:id" element={<SaaSCustomerDetail />} />
   </Route>
   ```
   No other route changes. `/trial-activation`, `/account-setup`, `/mail/oauth/callback` stay untouched.

### What this does NOT change

- No backend changes, no RLS edits, no new endpoints.
- `LockedScreen` itself is untouched (logo, copy, CTAs all stay).
- `BillingGuard` behavior on app routes is unchanged.
- Members (Hiring Managers) still have their existing scoped access.
- Stripe Checkout `return_url` doesn't need to change — `/billing` just becomes a locked surface for locked tenants.

### Verification

- Locked tenant → visit `/billing`, `/settings`, `/settings/members`, `/settings/workspace` → all render LockedScreen.
- Press Back in Stripe Checkout → land on `/billing` → LockedScreen (not the Settings shell).
- `payment_pending` tenant → `/billing` still opens Settings so they can launch the billing portal.
- Platform admin impersonating / browsing → unaffected, can still open the SaaS customer detail page.
