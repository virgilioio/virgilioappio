

# Booking Flow Bug Investigation

## Issues Found

### Issue 1: Confirmation page fails for unauthenticated candidates (PRIMARY)
The `BookingConfirmed` page (`src/pages/BookingConfirmed.tsx`) queries `scheduled_bookings` directly via the Supabase client. Candidates are **not authenticated**, so all RLS SELECT policies (which require `auth.uid()`) reject the query. The candidate sees **"Booking not found"** after successfully booking.

**Fix:** Add an RLS policy allowing anonymous/public SELECT on `scheduled_bookings` scoped by booking ID. Alternatively (and better), return the booking details from the `create-booking` edge function response and pass them via route state, or create a small edge function to fetch a booking by ID publicly (with limited fields).

The cleanest approach: add a public SELECT policy that allows reading a booking by its `id` only (the candidate already has the ID from the redirect URL). This is safe because booking IDs are UUIDs and not guessable.

**Migration:**
```sql
CREATE POLICY "Public can view booking by id"
ON public.scheduled_bookings
FOR SELECT
TO anon, authenticated
USING (true);
```

Wait -- that's too broad. Better: pass booking data via navigation state from the create-booking mutation success handler, and only show the data from state (no DB query needed for the confirmation page). If state is missing (direct URL visit), show a "Booking confirmed" message without details.

**Recommended approach:** Modify `BookingConfirmed.tsx` to accept booking data from React Router navigation state (passed from `PublicBookingPage` on success). Remove the direct Supabase query. For direct URL visits, show a generic confirmation. This avoids any RLS changes.

### Issue 2: Interviewer notification email fails (SECONDARY)
In `create-booking/index.ts`, the interviewer email block (line 674) uses `formatEmailList` and `createEmailTemplate` but doesn't import them. The import at line 609 is scoped inside the candidate email `try` block. The interviewer never gets their notification email.

**Fix:** Add `const { createEmailTemplate, formatEmailList } = await import('../_shared/emailTemplate.ts');` at the top of the interviewer email `try` block (around line 675).

## Implementation Plan

### 1. Fix `create-booking/index.ts` -- add missing import in interviewer email block
- Add the import statement inside the interviewer email try block (line 675)
- Redeploy the edge function

### 2. Fix `BookingConfirmed.tsx` -- pass data via route state instead of querying DB
- In `PublicBookingPage.tsx`, change `onSuccess` to use `navigate()` with state containing the booking response data + config/profile info
- In `BookingConfirmed.tsx`, read from `useLocation().state` instead of querying Supabase
- Keep a fallback generic "Booking Confirmed" message for direct URL visits

### Files to modify
- `supabase/functions/create-booking/index.ts` -- add missing email template import
- `src/pages/PublicBookingPage.tsx` -- pass booking data via navigate state
- `src/pages/BookingConfirmed.tsx` -- read from route state, remove Supabase query

