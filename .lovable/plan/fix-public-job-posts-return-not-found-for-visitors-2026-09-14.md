# Fix: public job posts return "not found" for visitors

## What's happening

Your job is open and its post is active, but the public page can't read the job record, so it falls back to the empty "posting not found" screen. Confirmed by requesting the page's data exactly as an anonymous visitor does: the request is rejected with "permission denied for table jobs".

The cause is the recent addition of Location, additional locations and Location Type to the public post. Those three job fields were never opened up for public reading, while the other job fields shown publicly (title status, salary, currency, salary visibility) were. One unreadable field rejects the whole request, so the entire page fails — not just the location line.

Verified state:
- The post `account-executive-enterprise-advisory-services-972uiy` exists, is active, not deleted, and its job status is `open`.
- The careers settings for the `virgilio` company page and the company info request both succeed for anonymous visitors.
- Reading the post alone succeeds; adding location / additional locations / location type is what fails.
- The careers list pages (`/careers/virgilio`) do not request those fields, so only individual post pages are affected.

## The fix

Grant public read access to exactly three job fields, matching what is already public for salary:

- `location`
- `additional_locations`
- `work_mode` (Location Type)

Nothing else about the job record becomes readable — internal title, description, budget, hiring team, skills, priority and dates all stay private. No app code changes, no changes to which posts are visible: only active posts on open jobs remain public.

## Technical detail

Migration granting column-level SELECT on `public.jobs` to `anon` for `location`, `additional_locations`, `work_mode`. The existing anon RLS policy ("Public can view open jobs with active postings", restricted to `deleted_at IS NULL AND status = 'open'` with an active posting) continues to gate which rows are visible; the grant only widens which columns of those rows can be read.

## Verification

1. Re-run the anonymous data request for the post and confirm it returns the row with location fields.
2. Load `https://app.gogio.io/careers/virgilio/account-executive-enterprise-advisory-services-972uiy` in a clean, logged-out browser and confirm the post renders with Location and Location Type.
3. Confirm the careers list page still lists the job and that no additional job fields leak into the public response.
