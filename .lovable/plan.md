# Fix: scheduling and cancelling fail for names with accented characters

## What's happening

Both errors come from one root cause, confirmed against the live data: the candidate on this application is **Miguel Abović**. The `ć` (U+0107) sits outside the Latin1 range, and every place we build a calendar invite or a booking link encodes text with raw `btoa(...)`, which only accepts characters up to U+00FF. So:

- `create-booking` throws `Cannot encode string: string contains characters outside of the Latin1 range` while base64-encoding the `.ics` attachment → 500, error toast, no booking email.
- `cancel-booking` throws the same on its cancellation `.ics` → 500 on cancel.
- In the browser, `encodeBookingContext` in `src/lib/bookingLinkUtils.ts` calls `btoa` on JSON that contains the candidate name → the console `InvalidCharacterError` raised during render of the Current stage card.

Any candidate with an accented or non-Latin1 name (ć, š, ž, ł, smart quotes, em dashes pasted from a doc) breaks scheduling today.

## The fix

1. **UTF-8-safe base64 helper, used everywhere text is encoded.** Encode the string to bytes first (`TextEncoder`), then base64 the bytes in chunks. Behaviour for plain-ASCII input is byte-identical to today.
   - `supabase/functions/create-booking/index.ts` — the two `.ics` encodings.
   - `supabase/functions/cancel-booking/index.ts` — the cancellation `.ics`.
   - `src/utils/icsGenerator.ts` — client-side `.ics` generation.
   - `src/lib/bookingLinkUtils.ts` — `encodeBookingContext` (URL-safe base64 of UTF-8 bytes) and the matching `decodeBookingContext` (decode bytes back through `TextDecoder`), so old ASCII links keep resolving.
   - `supabase/functions/send-user-email/index.ts` line ~242 — same pattern, for consistency.
2. **Also fix an unrelated 400 seen in the same log**: `src/hooks/useStageScorecardRequirement.ts` selects `candidates!inner(first_name, candidate_name)`, but `public.candidates` has no `first_name` column (verified), so that request returns 400 every time. Drop `first_name` from the select and keep the existing fallback that derives the first name from `candidate_name`.
3. Redeploy `create-booking`, `cancel-booking`, and `send-user-email`.

No changes to booking data model, permissions, invite recipients, ICS field content, or the scheduling UI flow.

## Verification

- Schedule an interview for Miguel Abović through the internal flow: booking succeeds, candidate and interviewer invites go out.
- Cancel it: no 500, cancellation email delivered.
- Open the Current stage card: no `btoa` console error, booking link copies and resolves.
- Confirm the `job_candidate_associations` 400 is gone from the network log.
