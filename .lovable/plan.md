

# Plan: Ensure Ingest Email is Auto-Accepted on Rescheduled Interviews

## What I found

Reschedules — both **internal** (recruiter sheet) and **public** (candidate booking page) — go through the same `create-booking` edge function. There is no separate "update-booking" path. The reschedule branch:

1. Deletes the old Google Calendar event(s)
2. Cancels the old `scheduled_bookings` row
3. Falls through into the normal "create new event" code, which is the same code that runs for first-time bookings

The new event creation block (line 384) does include the ingest email with `responseStatus: 'accepted'`:

```ts
attendees: [
  { email: profile.email },
  ...(transcriptIngestEmail ? [{ email: transcriptIngestEmail, responseStatus: 'accepted' }] : []),
  ...(guest_emails || []).map((ge: string) => ({ email: ge })),
],
```

So the code path is correct on paper. But the user is observing the ingest attendee showing as **not accepted** on a public-reschedule event.

## Most likely cause

There are 3 plausible reasons for what the user saw, in order of likelihood:

### 1. The event is created via the **candidate's** booking flow without the interviewer's OAuth token (most likely)

Public reschedules from the candidate's side run with whatever OAuth token is associated with the booking config. If `accessToken` or `calendarIdentity` is missing/expired at reschedule time (e.g. interviewer's Google token was revoked), the **entire calendar event creation block is skipped** (`if (accessToken && calendarIdentity)`). In that case the booking row exists but no Google event is recreated → no attendees → no ingest email at all on the invite.

### 2. Google silently ignores `responseStatus: 'accepted'` for non-resource attendees on insert in some cases

When Google Calendar's `events.insert` is called on behalf of the interviewer, attendees outside the organizer's domain are sometimes downgraded to `needsAction`. This can happen on reschedules if the previous event left a residual attendee status cache. The fix is to issue a follow-up `events.patch` that re-asserts `responseStatus: 'accepted'` for the ingest address only (Google honors organizer-set status for attendees on subsequent patch calls).

### 3. The new event is created but `sendUpdates` causes Google to reset attendee statuses

Currently the insert call doesn't pass `sendUpdates`. The default behavior can trigger an attendee-state recompute in some calendars. Explicitly setting `sendUpdates=externalOnly` along with re-patching the ingest attendee status guarantees the "accepted" state sticks.

## Verification I want to run before fixing

I need to look at the actual Google Calendar API response for the user's most recent reschedule event to know which of the 3 it is. I'll use Edge Function logs for `create-booking` filtered to the affected booking, and also inspect the resulting `scheduled_bookings` row to see if `google_event_id` is populated (rules out cause #1).

## Proposed fix (covers all 3 causes defensively)

In `supabase/functions/create-booking/index.ts`, after the new interviewer event is successfully created, add a follow-up `events.patch` call that re-asserts the ingest attendee's `responseStatus: 'accepted'` and explicitly sets `sendUpdates=externalOnly`. This is a small, idempotent guarantee that runs for both first bookings and reschedules.

```ts
// After successful insert, re-assert ingest acceptance
if (transcriptIngestEmail && googleEventId) {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}?sendUpdates=externalOnly`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attendees: [
          { email: profile.email },
          { email: transcriptIngestEmail, responseStatus: 'accepted' },
          ...(guest_emails || []).map((ge: string) => ({ email: ge })),
        ],
      }),
    }
  );
}
```

Also add a clear log line if the calendar event creation block is skipped (cause #1) so this is debuggable next time:

```ts
if (!accessToken || !calendarIdentity) {
  console.warn('[create-booking] No interviewer OAuth token — skipping calendar event creation. Ingest email will NOT be on the invite.');
}
```

## Files to change

- `supabase/functions/create-booking/index.ts` — add the follow-up patch and the missing-token warning. No other files touched.

## Out of scope

- No DB schema changes
- No frontend changes
- The internal reschedule flow already uses the same code path, so the fix covers it automatically

<lov-actions>
<lov-suggestion message="Apply the fix and then test by rescheduling an interview from the public booking page end-to-end, then check that the ingest email appears as Accepted on the new Google Calendar invite.">Apply fix and test reschedule end-to-end</lov-suggestion>
<lov-suggestion message="Before applying the fix, pull the create-booking edge function logs for my most recent rescheduled booking so we can confirm exactly which of the 3 causes hit me.">Check logs for my recent reschedule first</lov-suggestion>
<lov-suggestion message="Add a backfill script that scans recent rescheduled bookings, finds ones where the Google event is missing the ingest attendee or where it isn't accepted, and patches them.">Backfill ingest acceptance on past reschedules</lov-suggestion>
</lov-actions>
