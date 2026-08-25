# Fix: booking-link interviews saved in the ATS but never sent to Google Calendar

## What actually happened (verified in the database)

The Google connection for `allan.bravo@gomotive.com` is dead:

- `calendar_identities` for that user: `sync_status = expired`, `sync_error_message = "Token refresh failed"`, `token_expires_at = 2026-08-20 04:00`, last successful sync `2026-08-19 06:54`.
- Google rejected the stored refresh token (revoked / password change / app access removed). A revoked refresh token cannot be repaired server-side — the user must reconnect.

`supabase/functions/create-booking/index.ts` treats a missing calendar token as non-fatal: it logs `Proceeding without calendar integration`, skips the Google event creation entirely, and still writes the booking row. Result: the ATS calendar shows the interviews, but no Google event and no invite for the interviewer or the candidate.

Affected rows — 8 bookings created on 24 Aug, all with `google_event_id = NULL` and `candidate_google_event_id = NULL`, all `status = confirmed`, all on booking config `13ebaf60`:

```text
25 Aug 16:45 UTC  rafacastcorr@gmail.com
25 Aug 17:30 UTC  juantorresdg00@gmail.com
25 Aug 18:15 UTC  khernandezlaura@gmail.com
25 Aug 19:45 UTC  saulmedinao3.14@gmail.com
25 Aug 20:30 UTC  rafa44022@gmail.com
26 Aug 19:00 UTC  oraliagonzalezbaron@gmail.com
26 Aug 19:45 UTC  leunam0802@hotmail.com
27 Aug 16:45 UTC  ryrueda1@gmail.com
```

(Three older `cancelled` rows from February also lack events; they need no action.)

## Step 1 — reconnect (must happen first, by the user)

Allan Bravo signs in and reconnects Google in Settings → Email & calendar (Disconnect, then Connect). Nothing below can create events until a fresh refresh token exists. Two of these interviews are today, so this is the urgent part.

## Step 2 — repair the 8 orphan bookings

New edge function `repair-booking-calendar-events`:

- Input: an explicit list of booking ids, or `{ user_id }` to sweep that user's `confirmed`, future bookings where `google_event_id is null`.
- For each booking, reuse the exact event-creation logic already in `create-booking`: refresh the access token, create the interviewer event (with Meet link + transcript ingest email in the description) and the separate candidate-facing event with `sendUpdates=externalOnly`, then write back `google_event_id`, `candidate_google_event_id`, `google_meet_link`, `last_synced_at`.
- Idempotent: skips any booking that already has `google_event_id`, so it can be re-run safely.
- Returns a per-booking result so we can confirm all 8 landed, and refuses to run (clear error, no partial writes) if the identity is still `expired`.

To avoid duplicating a 200-line block, the event-creation body moves into `supabase/functions/_shared/googleBookingEvents.ts` and both `create-booking` and the repair function call it. No behavioral change to `create-booking`'s happy path.

After reconnect, I run the repair for that user and report which events were created.

## Step 3 — stop this from happening silently again

1. **Public booking link guard.** Before accepting a public booking, `create-booking` checks the owner's calendar identity. If it is missing or `expired`, it returns a clear error instead of writing a phantom booking, and the public booking page shows "This calendar is temporarily unavailable — please contact the recruiter." Recruiter-initiated internal scheduling keeps today's tolerant behaviour (advisory only), since a recruiter can see the warning.
2. **Truthful Settings status.** The current Settings → Email & calendar row treats "a row exists" as "Connected". Change it to derive the Google Workspace state from `sync_status`, `sync_error_message`, and token expiry across both mail and calendar identities:
   - `Connected` only when the relevant identities are healthy/active and token data is usable.
   - `Reconnect required` when either side is `expired`, has a token refresh failure, or the token is past expiry.
   - Show the provider error message in amber, not red; red remains reserved for destructive actions.
   - In the reconnect state, the primary action is `Reconnect Google`; `Disconnect` remains available as a secondary action.
3. **Reliable disconnect.** The current combined Google Workspace disconnect calls the calendar mutation through `mutate`, then `await`s it even though it is not promise-returning. Replace this with a reliable promise-based disconnect path for both mail and calendar identities, invalidate both queries on completion, and show a visible error if either table delete fails. If direct RLS deletion is still unreliable, move disconnect into an authenticated edge function that verifies the caller and deletes both identity rows with service-role.
4. **Record the failure.** When calendar sync is skipped for any reason, write the reason into the booking's `sync_errors` — right now those rows have an empty array, which is why the failure was invisible.
5. **Warn the owner.** When a token refresh fails, send the identity owner a "Reconnect Google" email (once per day, not per attempt) and surface a persistent banner in the app plus a "Reconnect" state on the Settings → Email & calendar row, so an expired connection is never silent for five days again.

## Technical notes

- Files: `supabase/functions/create-booking/index.ts`, new `supabase/functions/repair-booking-calendar-events/index.ts`, new `supabase/functions/_shared/googleBookingEvents.ts`, `src/components/settings/tabs/EmailCalendarTab.tsx` (reconnect state), `src/hooks/useCalendarIdentities.ts` / `src/hooks/useMailIdentities.ts` (promise-based disconnect + status fields), plus a small banner component for the expired-connection warning.
- No schema changes required — `sync_status`, `sync_error_message` and `sync_errors` already exist.
- No changes to booking data shape, availability logic, or permissions.
