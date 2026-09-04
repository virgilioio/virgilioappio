# Booking link: correct timezone detection and displayed times

## What's happening today

Two separate problems on the public booking page (both the general event-type link and the job/candidate links, since they share the same page):

1. **The visitor's timezone looks unselected.** The page does detect the browser timezone, but the timezone dropdown only contains 11 hand-picked zones (New York, Chicago, Denver, Los Angeles, London, Paris, Berlin, Tokyo, Shanghai, Singapore, Sydney). Anyone outside that short list — Mexico City, Madrid, Bogota, Sao Paulo, Toronto, Dubai, and so on — gets a blank-looking selector, because their detected zone isn't one of the options.

2. **The times shown never follow the selected timezone.** Every time on the page (slot buttons, the day heading, the confirmation panel, the confirmed page, the existing-booking view) is formatted using the *viewer's device clock*, not the chosen timezone. So the times you see are your own CST clock no matter what the dropdown says, and switching the dropdown changes which slots the server returns but not how they're labelled. Same for which calendar day a slot is grouped under — near midnight a slot can land on the wrong day for a visitor in a distant zone.

## What we'll change

**Timezone selector**
- Offer the full list of world timezones (grouped by region, searchable), so any visitor's zone can be found and their detected zone is always pre-selected.
- Show each option with its current offset (e.g. "Mexico City (GMT-6)") plus a short "Detected" marker on the auto-picked one.
- Keep the same control placement and styling; the general event-type picker screen keeps showing the same zone label, formatted the same friendly way.

**Times displayed**
- Render every time and date on the booking flow in the *selected* timezone, with the zone abbreviation next to it, so changing the dropdown visibly re-labels the slots.
- Group slots into days by the selected timezone as well, so the calendar day and the "Wednesday, June 3" heading always agree with the times listed under them.
- Apply the same treatment to the confirmation panel, the "you're booked" screen, and the existing/reschedule view.

No change to availability rules, the booking mutation, what gets stored, or the calendar invites — the selected timezone is already sent to the server and saved with the booking.

## Technical notes

- `src/pages/PublicBookingPage.tsx`: replace `COMMON_TIMEZONES` + `<Select>` with a searchable, grouped list built from `Intl.supportedValuesOf('timeZone')` (fallback to a static list if unsupported), keeping `candidateTimezone` state and the value passed to `useBookingAvailability` / `create-booking` unchanged. Change `availableDates` derivation and `timeSlotsForSelectedDate` filtering to compare zone-local day keys (`Intl.DateTimeFormat` with `timeZone: candidateTimezone`, `en-CA` y-m-d) instead of `toDateString()` / `isSameDay`, and the day heading to format in that zone.
- Add a small helper (e.g. `src/lib/timezoneFormat.ts`) with `formatInTimeZone(date, tz, opts)`, `zoneDayKey(date, tz)`, `zoneAbbr(tz, date)`, and `tzOptions()` — thin `Intl.DateTimeFormat` wrappers, no new dependency.
- Pass `candidateTimezone` into `TimeSlotsList` and use the helper for slot labels; `BookingConfirmationForm` already receives `candidateTimezone` but ignores it for formatting — switch its `format()` calls to the helper.
- `BookingConfirmed.tsx` and `ExistingBookingView.tsx`: format from `booking.candidate_timezone` (already stored/passed) rather than local time; keep the existing `timeZoneName` abbreviation logic.
- Public-page styling stays within the existing booking chrome; the searchable list reuses the project's command/popover primitives already used by `SearchableSelect`.
