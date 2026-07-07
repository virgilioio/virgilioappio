## Problem

Two related issues in the "Review complete" screen's bulk outreach flow:

1. Clicking **Start outreach to advanced (N)** opens a custom right-side `BulkOutreachSheet` — but the app already has a real email composer (`MinimizableEmailComposer`) that supports bulk mode natively. Behavior should match single-send.
2. When sending, an **error toast appears even though the email is actually delivered** (edge-function logs confirm `Email sent successfully` for Allan Bravo). The false error originates inside `BulkOutreachSheet`'s local send path — the standard composer's bulk path does not have this bug.

## Root cause of the false error

`BulkOutreachSheet` calls `bulk.sendBulkEmailAsync(...)` but only passes `associationIds` + `emailData`. The recipients selection in the sheet UI never trims `associationIds` (e.g. removed rows), and the sheet sets its own local `sent` state — but it doesn't distinguish `mutation.onError` (fires the destructive toast) from partial-success. In practice the mutation's `mutationFn` promise resolves fine, but the `.single()` profile fetch inside `useBulkSendEmail` can throw (no matching profile row / RLS edge), causing `onError` to fire the toast *after* the actual email has already been sent by the edge function.

Rather than patching this parallel implementation, we retire it and route through the same composer used everywhere else — which already handles bulk cleanly (subject, per-candidate personalization, progress, "Skipped: no email" pill, success/failure toast, minimize).

## Fix

Replace `BulkOutreachSheet` with `MinimizableEmailComposer` in bulk mode.

### Changes in `src/pages/ApplicationReview.tsx`

1. Delete the `BulkOutreachSheet` component (lines ~1178–1330) and its render block (lines ~1599–1607).
2. When the user clicks **Start outreach to advanced (N)**, open a second `MinimizableEmailComposer` instance with:
   - `bulk={{ candidateIds: advancedList.map(c => c.candidateId), jobId }}`
   - `bulkJobTitle={jobTitle}` (already available)
   - `jobId={jobId}`
   - `onSuccess={() => { closeBulk(); goStage() }}` — after send succeeds, navigate to the advance-destination stage (existing `goStage` handler from the completion state).
3. Keep the existing per-candidate `MinimizableEmailComposer` (single-send) untouched.
4. State: replace `const [bulkOpen, setBulkOpen]` with a single `bulkOpen` boolean gate; render the composer only when `bulkOpen && advancedList.length > 0`.

### Verification

- `bunx tsgo --noEmit` for type safety.
- Manually re-test: complete a review with ≥1 advanced candidate → click **Start outreach to advanced** → composer opens as our standard email composer with the recipients pill showing N recipients → send → single success toast, no destructive toast, navigation to the advance stage.

## Non-goals

- No changes to `useBulkSendEmail` internals, `send-user-email` edge function, or single-send composer behavior.
- No visual changes elsewhere on the completion screen.
