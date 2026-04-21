

## Auto-detect timezone for booking setup (Calendly-style)

### What's there today
- New users going through onboarding **do** pass their browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) when creating their booking config. ✅
- Default schedule is already Mon–Fri 9–5 in whatever timezone is passed. ✅
- **Gap 1**: The `create-booking-config` edge function falls back to hardcoded `'America/New_York'` if no timezone is sent. The lazy-creation path in `useBookingConfig.ts` passes `profile.timezone || undefined` — and `profile.timezone` is often empty for older accounts → they end up on ET regardless of where they actually are.
- **Gap 2**: `profile.timezone` is never auto-populated. It only exists if the user manually set it.
- **Gap 3**: The Settings → Booking timezone selector defaults to whatever's stored, with no "Detected: America/Los_Angeles — use this?" hint.

### Goal
A user signing up in São Paulo gets Mon–Fri 9–5 **São Paulo time** with zero configuration, matching Calendly's behavior. Existing users on a wrong-timezone default get a one-time gentle nudge to switch.

### Changes

**1. `supabase/functions/create-booking-config/index.ts`** — remove the `'America/New_York'` hardcoded fallback. If no timezone is provided, leave `timezone` unset and let the column default (which we'll set to `'UTC'`) apply, OR better: require the caller to send one. Since both call sites (Onboarding + lazy-create hook) can detect the browser timezone, make the parameter required and have the hook always pass `Intl.DateTimeFormat().resolvedOptions().timeZone` as a fallback.

**2. `src/hooks/useBookingConfig.ts`** — in the lazy-create `useQuery`, change:
   ```ts
   timezone: profile.timezone || undefined,
   ```
   to:
   ```ts
   timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
   ```
   So even users with an empty profile timezone get their browser timezone instead of the ET fallback.

**3. Auto-populate `profiles.timezone` on first sign-in** — add a small effect in `AuthContext` (or `useUserProfile`) that, if the authenticated user's `profiles.timezone` is null/empty, writes the browser-detected timezone to it once. This single source of truth then flows to:
   - booking config creation (already reads `profile.timezone`)
   - email "send time" formatting
   - dashboard agenda widget
   - any future timezone-aware feature

**4. Settings → Booking timezone mismatch nudge** — in `TimezoneSelector.tsx` (or the parent booking settings page), detect when `config.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone` and show a small inline hint above the selector:
   > 🌍 Your browser is set to **America/Los_Angeles**. Switch? [Use this timezone]
   
   Dismissible, non-blocking. Mirrors Calendly's banner on the booking settings page.

**5. Backfill nudge for existing affected users (optional, recommended)** — for users whose `booking_configurations.timezone = 'America/New_York'` (the old default) but whose browser timezone differs, show the same banner once on the Booking settings page. No automatic DB rewrite — user confirms.

### Files touched
- `supabase/functions/create-booking-config/index.ts` — remove hardcoded fallback
- `src/hooks/useBookingConfig.ts` — pass browser TZ in lazy-create
- `src/contexts/AuthContext.tsx` *(or)* `src/hooks/useUserProfile.ts` — one-time auto-populate `profiles.timezone`
- `src/components/settings/booking/TimezoneSelector.tsx` — mismatch hint + "Use this" button
- *(no DB schema changes, no new migrations)*

### Out of scope
- Changing the timezone for the **candidate** picking a slot — that's already auto-detected on the public booking page from their browser.
- Server-side timezone inference from IP (browser detection is more accurate and doesn't require IP geolocation).

### Open question
Should the one-time auto-populate of `profiles.timezone` (step 3) **also** rewrite the existing `booking_configurations.timezone` for that user if it still equals the old `'America/New_York'` default? This would silently fix existing users with no action needed — but silently changing availability config can be surprising. **Recommendation:** don't rewrite silently; show the nudge banner (step 4/5) and let the user click to apply. Confirm or override.

