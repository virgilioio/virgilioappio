# Fix: "View Details" does nothing for booked interviews

## Root cause

In `src/components/candidates/StageBookingsList.tsx` (the list of scheduled interviews shown in a candidate's stage on their profile), the "View Details" dropdown item has no `onClick` handler — it's a dead button:

```tsx
<DropdownMenuItem>
  <Eye className="h-4 w-4 mr-2" />
  View Details
</DropdownMenuItem>
```

That's why nothing opens when the recruiter clicks it on Fernando Mora's interview. The booking itself is visible (RLS on `scheduled_bookings` already allows tenant members + the interviewer), so all that's missing is the UI wiring.

We already have a fully-built `BookingDetailsDialog` (`src/components/booking/BookingDetailsDialog.tsx`) that:
- loads the booking + candidate + job + stage,
- fetches `scheduled_booking_attendees` and resolves all interviewer profiles (so it correctly renders **group** bookings, not just single-host ones),
- supports cancel, ICS download, copying meeting link, etc.

It's already used from the dashboard's Upcoming Activities and from job CandidateCard, so this is the canonical detail view.

## Changes

### 1. `src/components/candidates/StageBookingsList.tsx`
- Add local state: `const [detailsBookingId, setDetailsBookingId] = useState<string | null>(null)`.
- Import `BookingDetailsDialog`.
- Set `onClick={() => setDetailsBookingId(booking.id)}` on the "View Details" `DropdownMenuItem`.
- Render `<BookingDetailsDialog bookingId={detailsBookingId} open={!!detailsBookingId} onOpenChange={(o) => !o && setDetailsBookingId(null)} onBookingUpdated={() => queryClient.invalidateQueries({ queryKey: ['stage-bookings'] })} />` at the bottom of the component.

### 2. Sanity verification (no code change expected)
- Confirm `BookingDetailsDialog` renders the multi-interviewer list for group bookings (it already iterates `interviewers`). If the group section is hidden behind a single-host layout in the dialog, expose a small "Interviewers (N)" block similar to `StageBookingsList` so recruiters see all participants of a group booking. We'll inspect on implementation and adjust only if missing.

## Out of scope

- No DB / RLS changes — recruiters in the same tenant already pass the `scheduled_bookings_select_tenant` policy.
- No edge-function changes.
