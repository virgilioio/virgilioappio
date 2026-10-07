# One Google Workspace connection, used everywhere

## What's wrong today
- Jurre (Member) has no Google connected at all — no email, no calendar.
- There are two separate Google Workspace screens that behave differently:
  - **Settings → Email & calendar** (every user sees it): connect, reconnect, and a full disconnect.
  - **Settings → Integrations → Google Workspace** (admins/owners only): its own connect button, separate "Reconnect Calendar" button, and a disconnect that removes email and calendar one by one.
- Both start the same Google sign-in, but they differ afterwards: different success messages, only one turns on the booking link afterwards, the status ("Connected" / "Reconnect required") is worked out differently, and the two disconnects don't clean up the same things.

## What changes
- One shared Google Workspace card, with one connect / reconnect / disconnect flow, shown in both places:
  - **Settings → Email & calendar** — the main home for every user, including Members, Hiring Managers and Interviewers.
  - **Settings → Integrations → Google Workspace** — opens the same card. The Integrations menu stays admin/owner only.
- The same status everywhere: Connected (with the email address), Reconnect required (with the reason), or Not connected.
- After connecting, every time: email and calendar both linked, calendar sync and time zone set up, the booking link turned on, and one clear "Google Workspace connected: name@…" confirmation.
- Disconnect always removes email and calendar together.
- The "Connect Google" prompts elsewhere (setup checklist, scheduling, booking) point to Settings → Email & calendar, so Members never land on a page they can't open.

## After this
Jurre connects from Settings → Email & calendar → Connect. I'll then check his email and calendar both show as connected.

## Technical details
- New `src/hooks/useGoogleWorkspaceConnection.ts`: wraps `mail-oauth-start` popup + `mail-oauth-callback` (which already creates the calendar identity and calls `setup-calendar-watch` / `sync-calendar-timezone` server-side). On success it invalidates mail/calendar/booking-config/user-profile queries, runs the booking-config activation check (moved out of `useCalendarIdentities.connectGoogleCalendar`), and refreshes onboarding progress. Derives state with the existing `hasTokenFailure` rules. Disconnect always goes through `disconnect-google-workspace`.
- New `src/components/settings/GoogleWorkspaceCard.tsx` (the current Email & calendar row UI), used by `tabs/EmailCalendarTab.tsx` and as the Integrations `DetailComponent` in place of `GoogleWorkspaceIntegrationSection`.
- `useCalendarIdentities.connectGoogleCalendar` and `useMailIdentities.connectGmail` become thin calls into the shared hook so other callers keep working; remove the unused `GoogleWorkspaceIntegrationSection`, `EmailAccountsSection`, `CalendarIntegrationSection` once nothing imports them.
- `useGoogleConnected` (integration status) reuses the shared state so the Integrations tile matches.
- Repoint any `tab=integrations` / `integration-google-workspace` links shown to non-admins to `tab=email-calendar`.
- No database or edge-function changes.
