# Stop the repeated "Interview notes ready" emails

## What is happening

You got exactly 6 notification emails per candidate, and the send times explain everything:

```text
Diego Ochoa      18:18:51 · 18:20:10 · 18:27:47 · 19:14:18 · 21:13:48 · 02:53:17
Daniela Velásquez 18:40:11 · 18:41:47 · 18:48:26 · 19:19:58 · 21:23:06 · 02:54:56
```

The gaps grow: ~1 minute, ~7 minutes, ~47 minutes, ~2 hours, ~5 hours. That is the delivery-retry
schedule of the mail service that hands us the Fireflies recap. Each candidate really received only
one recap from Fireflies (18:27 and 18:45), and their interview record holds a single transcript —
so nothing is looping on our side by itself: the same recap is being handed to us again and again.

Why the hand-off is treated as failed: when the recap arrives, our intake step does all the heavy
work before answering — it re-fetches the message with built-in waits, then waits for the full AI
note generation to finish. That takes far longer than the sender is willing to wait, so it never
sees a success, marks the delivery as failed, and retries with growing delays. Every retry redoes
the whole job and sends a fresh "notes ready" email. Nothing prevents that, because the intake step
does not remember which recap it already handled, and the notification is sent unconditionally.

The same thing happened to Pasquale Calcagno on Sep 11 (5 emails), so it is not specific to these
two candidates.

## The fix

1. **Answer the hand-off immediately.** The intake step confirms receipt as soon as the transcript is
   stored, and the note generation continues in the background instead of holding the response open.
   The sender then sees success on the first try and stops retrying.
2. **Remember each recap.** Record the incoming message's unique id on the interview record and
   ignore a repeat delivery of the same recap: confirm receipt and do nothing else.
3. **Send the notification once.** Stamp the interview record when the "notes ready" email goes out
   and skip the email if it was already sent for that interview. Regenerating notes later still
   updates the draft — it just won't re-email.

No change to how notes are written, to the draft scorecard, or to the email's content and recipient.

## Technical detail

- Migration on `public.scheduled_bookings`: add `transcript_source_message_id text` and
  `transcript_notified_at timestamptz`, plus a partial unique index on the message id so a
  concurrent duplicate delivery cannot slip through.
- `supabase/functions/process-transcript-webhook/index.ts`:
  - after resolving the booking, compare `payload.data.email_id` with the stored
    `transcript_source_message_id`; if equal, return `200 {status:'duplicate_delivery'}` before any
    fetching or generation;
  - store that id alongside `transcript_raw`;
  - replace the awaited `fetch` to `generate-scorecard-from-transcript` with a background task
    (`EdgeRuntime.waitUntil`) and return `200` right away; failures are logged, not retried by the
    sender.
- `supabase/functions/generate-scorecard-from-transcript/index.ts`: gate the Resend send on
  `transcript_notified_at` being null, and set it in the same step as the send. Generation and the
  scorecard draft update stay unchanged.
- Verify by re-posting the same recap payload twice: first call stores and notifies, second returns
  `duplicate_delivery` with no email; then confirm in `email_logs` that no new
  "Interview notes ready" rows appear for these two candidates.
