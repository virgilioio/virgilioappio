

## Update emails to list all interviewers for group bookings

### Goal
When a group (AND-mode) booking is created, both the candidate confirmation and the per-interviewer notification emails should reflect that multiple interviewers are attending — not just the primary host.

### Changes

**File:** `supabase/functions/create-booking/index.ts` (single file, 3 small edits)

**1. Build a shared "interviewers display" string near the top of the email-sending blocks**

After `groupAttendeeProfiles` is populated (around line 244), keep the data; right before line 859 (candidate email block), compute:

```ts
const allInterviewerNames = isGroupBooking
  ? [`${profile.first_name} ${profile.last_name}`, ...groupAttendeeProfiles.map(p => `${p.first_name} ${p.last_name}`)]
  : [`${profile.first_name} ${profile.last_name}`];

const interviewersDisplay = formatNamesList(allInterviewerNames); 
// e.g. "Alice Smith, Bob Jones & Carol Lee"
```

Add a small local `formatNamesList` helper (Oxford-comma style with `&` for the last separator) — same pattern already used on `PublicBookingPage`.

**2. Candidate confirmation email (lines 875–911)**

- Change the `Interviewer:` line label to `Interviewers:` when group, and use `interviewersDisplay`.
- Change the intro paragraph from "Your interview with **{primary}** has been confirmed!" to "Your interview with **{interviewersDisplay}** has been confirmed!"
- Subject stays the same (stage + job title — interviewers aren't typically in subject lines).
- Preheader stays the same.

**3. Interviewer notification email (lines 928–1010)**

The notification is currently sent only to `profile.email` (the primary). For group bookings, send the same notification to **all** interviewers so each gets the ICS, Meet link, candidate profile link, and scorecard CTA.

- Build the recipient list:
  ```ts
  const interviewerRecipients = isGroupBooking
    ? [profile.email, ...groupAttendeeProfiles.map(p => p.email).filter(Boolean)]
    : [profile.email];
  ```
- In the email body, add a new line in `interviewDetails` when group: `<strong>Co-interviewers:</strong> {names of others}` so each recipient sees who else is on the call.
- Use a generic salutation when group (`recipientName: 'there'`) since one rendered email goes to multiple people. Alternatively, loop and send N personalized emails — slightly more code but better UX. **Recommended: loop**, reusing the same `interviewerEmailBody` builder per recipient with their own first name. This adds ~10 lines but each interviewer gets a properly addressed email.
- ICS attendees in the calendar invite already include all group attendees (lines 579–600), so the ICS file generation at line 823 should also include them — add the group interviewers to `icsAttendees` when `isGroupBooking`.

**4. ICS attendees (line 823)**

Add the additional group interviewers as `ATTENDEE` lines so external calendar clients (Outlook, Apple Calendar) show the full participant list:

```ts
const icsAttendees = [
  ...(send_invitation ? [`ATTENDEE;CN=${escapeICSText(candidate_name)};RSVP=TRUE:mailto:${candidate_email}`] : []),
  ...(isGroupBooking ? groupAttendeeProfiles.map(p => `ATTENDEE;CN=${escapeICSText(`${p.first_name} ${p.last_name}`)};RSVP=TRUE:mailto:${p.email}`) : []),
  ...(guest_emails || []).map((ge: string) => `ATTENDEE;RSVP=TRUE:mailto:${ge}`),
].join('\r\n');
```

The primary interviewer is already the `ORGANIZER` line, so they don't need to be duplicated as an attendee.

### Out of scope (for a follow-up if needed)
- Reschedule/cancel paths re-sending updated invites to all attendees — currently they only handle the primary. Worth a separate ticket once this lands and is verified.
- Surfacing co-interviewers in in-app booking detail views (`/scheduled-bookings` UI).

### Files touched
- `supabase/functions/create-booking/index.ts` — only file. No frontend, no DB, no new edge functions.

