

# Add Guest Emails to Interview Scheduling (Updated with Cancellation Support)

## Overview

Allow users to add additional guest email addresses when scheduling interviews manually. Guests receive ICS calendar invites via email. When an interview is cancelled, guests also receive cancellation ICS emails -- just like the candidate and interviewer already do.

## User Experience

In the confirmation step of the scheduling flow, a new "Add Guests" section appears below the notes field:

- Text input where users type an email and press Enter/comma/space to add it as a chip
- Each chip shows the email with an X to remove
- Email format validation, duplicate prevention, max 10 guests
- Optional -- scheduling works exactly as before if no guests added

## Technical Changes

### 1. Database: Add `guest_emails` column

```sql
ALTER TABLE scheduled_bookings ADD COLUMN guest_emails text[] DEFAULT '{}';
```

### 2. New Component: `GuestEmailInput`

**File: `src/components/scheduling/GuestEmailInput.tsx`** (new)

Chip-based email input with validation, using existing Input and Badge components.

### 3. Frontend: Integrate into both scheduling sheets

**Files:**
- `src/components/candidates/ScheduleInterviewSheet.tsx`
- `src/components/candidates/SimpleScheduleInterviewSheet.tsx`

Add `guestEmails` state, render `GuestEmailInput` in the confirmation form, pass `guest_emails` array to `create-booking`.

### 4. Edge Function: `create-booking` -- process guests

**File: `supabase/functions/create-booking/index.ts`**

- Accept `guest_emails` from request body
- Store in `scheduled_bookings` insert
- Add guests as ATTENDEE entries in the ICS file
- Add guests as attendees on the Google Calendar event (if connected)
- Send each guest an ICS email with interview details via `send-user-email`

### 5. Edge Function: `cancel-booking` -- send cancellation to guests

**File: `supabase/functions/cancel-booking/index.ts`**

Currently only emails the candidate and interviewer. Changes:

- Read `booking.guest_emails` from the fetched booking record (already available since `select('*')` is used)
- Add each guest as an ATTENDEE line in the cancellation ICS content
- After sending to candidate and interviewer, loop over `guest_emails` and send each guest a cancellation email with:
  - The cancellation ICS file (METHOD:CANCEL) so their calendar updates automatically
  - An email body explaining the interview was cancelled, including the interview title, original date, and reason (if provided)

The guest cancellation email will use the same `createEmailTemplate` already imported, with content like:

```text
An interview you were invited to has been cancelled.

Interview: [Stage] - [Job Title]
Originally Scheduled: [Date/Time]
Reason: [if provided]

A calendar cancellation has been attached to update your calendar.
```

### 6. Update Types

`guest_emails` will be auto-generated in Supabase types after migration.

## Files Modified

| File | Change |
|------|--------|
| Database migration | Add `guest_emails text[]` to `scheduled_bookings` |
| `src/components/scheduling/GuestEmailInput.tsx` | New: email chip input component |
| `src/components/candidates/ScheduleInterviewSheet.tsx` | Add guest emails state and UI |
| `src/components/candidates/SimpleScheduleInterviewSheet.tsx` | Same guest emails integration |
| `supabase/functions/create-booking/index.ts` | Accept guests, add to calendar + send ICS emails |
| `supabase/functions/cancel-booking/index.ts` | Send cancellation ICS emails to all guests |

