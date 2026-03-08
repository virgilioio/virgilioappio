

# Auto-Cancel Interviews on Candidate Rejection

## Problem
When a candidate is rejected (single or bulk), any scheduled interviews remain active. They should be automatically cancelled via the existing `cancel-booking` edge function, which handles Google Calendar deletion, cancellation emails to interviewers/guests, and ICS updates.

## Solution
After updating the association status to "rejected", query `scheduled_bookings` for any active interviews (`status in ('confirmed', 'rescheduled')`) for that candidate + job combo, then call the `cancel-booking` edge function for each one.

### Changes

**1. `src/hooks/useRejectCandidate.ts`**
After the association status update (line 62), before handling the rejection email:
- Query `scheduled_bookings` for `candidate_id` + `job_id` where `status in ('confirmed', 'rescheduled')`
- For each booking found, invoke `cancel-booking` edge function with `booking_id` and reason `"Candidate rejected"`
- Log failures but don't block the rejection (best-effort cancellation)

**2. `src/hooks/useBulkRejectCandidates.ts`**
Same pattern inside each association's processing block (after line 80):
- Query `scheduled_bookings` for `candidate_id` from that association where `status in ('confirmed', 'rescheduled')`
- Call `cancel-booking` for each booking
- Best-effort -- log errors, don't throw

### Code pattern (same for both hooks)
```typescript
// Cancel any scheduled interviews for this candidate
const { data: activeBookings } = await supabase
  .from('scheduled_bookings')
  .select('id')
  .eq('candidate_id', association.candidate_id)
  .in('status', ['confirmed', 'rescheduled']);

if (activeBookings?.length) {
  await Promise.allSettled(
    activeBookings.map(booking =>
      supabase.functions.invoke('cancel-booking', {
        body: { booking_id: booking.id, reason: 'Candidate rejected' },
      })
    )
  );
}
```

No database changes or edge function changes needed -- the existing `cancel-booking` function handles everything (calendar deletion, emails, status update).

