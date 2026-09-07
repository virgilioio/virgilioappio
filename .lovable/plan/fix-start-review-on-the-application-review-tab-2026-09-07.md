# Fix "Start review" on the Application review tab

## What happens today
On the job page, the Application review tab's "Start review" button opens the first candidate's normal profile instead of the dedicated review experience.

## Cause
The button's handler picks the first candidate in the list and opens their profile. The purpose-built review screen is already loaded on the job page but nothing ever opens it.

## The fix
Point "Start review" at the existing review screen:

- Change the `onStartReview` handler in `src/pages/JobDetail.tsx` (around line 550) from `openProfileInPlace(first.id, ...)` to `setShowApplicationReview(true)`.
- `ApplicationReviewSheet` is already mounted at the bottom of `JobDetail.tsx` with `jobId`, `jobTitle` and an `onComplete` that refreshes the pipeline, so no other wiring is needed.
- Keep the button disabled/no-op when the queue is empty (guard on the application-review candidate list being non-empty).

Nothing else changes: row clicks still open candidate profiles, and the review flow's own logic, data and permissions stay untouched.

## Note
There is also a full-page version of the review at `/jobs/:jobId/review`. This plan uses the in-page review panel since it is already wired into the job page; say the word if you would rather the button navigate to the full page instead.
