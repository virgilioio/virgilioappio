## Goal

Make booking link timezone reflect the user's actual Google Calendar timezone, automatically — both for new connections and as a one-time backfill for existing users.

## Current state

- 25+ users have an active Google calendar (`calendar_identities.is_active = true`) but their `booking_configurations.timezone` is still `UTC` (e.g. mayela@huntinghappiness, constancio…, malena@virgilio, support@virgilio, zaraid@…). Their `profiles.timezone` is also `UTC`.
- `create-booking-config` only resolves timezone from `profiles.timezone` → request body → `UTC`. It never asks Google.
- `mail-oauth-callback` stores the calendar identity but doesn't capture the user's calendar timezone.
- Result: every booking config defaults to UTC unless the user manually changes it in settings.

## Plan

### 1. New edge function: `sync-calendar-timezone`

- Input: `calendar_identity_id` (or resolves the active one for the caller).
- Loads the calendar identity, refreshes the access token if needed (reuse the existing refresh helper used by `check-calendar-availability` / `get-booking-availability`).
- Calls Google: `GET https://www.googleapis.com/calendar/v3/users/me/settings/timezone` → returns `{ value: "America/Mexico_City" }`.
- Updates:
  - `profiles.timezone` (only if currently `UTC`/null, so we don't overwrite explicit user choices).
  - `booking_configurations.timezone` for that user (only if currently `UTC`/null, same reason).
- Returns the resolved timezone.

### 2. Wire it into the OAuth flow (automatic for new connects)

In `mail-oauth-callback`, right after the calendar identity is upserted and the watch is set up, invoke `sync-calendar-timezone` with the new identity id. This way every freshly connected Google account gets the right timezone with no user action.

Optional safety net: `useCalendarIdentities.connectGoogleCalendar` already runs post-connect setup in the popup handler — we'll also invoke `sync-calendar-timezone` there as a fallback in case the server-side call fails.

### 3. One-time backfill for existing users

Add a small admin-triggered backfill path:
- A new edge function `backfill-calendar-timezones` (service-role, no caller auth) that iterates every active `calendar_identities` row, calls the same logic as #1 per identity, and logs results.
- We invoke it once via the Supabase function curl tool right after deploy. No DB migration needed because the data lives in `profiles` + `booking_configurations` and the function uses the standard update path (only fills UTC/null values, preserves anything custom).

### 4. UX guardrails (preserve user intent)

- Never overwrite a non-UTC timezone — if a user (or admin) already picked something, we leave it alone.
- The existing `TimezoneSelector` "browser timezone differs" banner stays, so users can still adjust manually after the fact.

## Files

Edge functions (new):
- `supabase/functions/sync-calendar-timezone/index.ts`
- `supabase/functions/backfill-calendar-timezones/index.ts`

Edge functions (edit):
- `supabase/functions/mail-oauth-callback/index.ts` — invoke `sync-calendar-timezone` after calendar identity upsert.

Frontend (edit, optional fallback):
- `src/hooks/useCalendarIdentities.ts` — invoke `sync-calendar-timezone` after successful OAuth, then invalidate `booking-config` query so the UI shows the new timezone immediately.

### Execution

After deploy, run `backfill-calendar-timezones` once to fix the ~25 existing affected accounts. From then on, the OAuth callback handles it automatically.