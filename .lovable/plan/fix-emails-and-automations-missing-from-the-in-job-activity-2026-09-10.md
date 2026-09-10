# Fix: emails and automations missing from the in-job Activity tab

## What's wrong (confirmed)

The in-job Activity feed asks the database for this candidate's activities **on this job**. That filter reads `job_id` from each activity's stored metadata. Email activities are written without a `job_id` (only `email_log_id`, subject, recipients), so the job filter silently drops every one of them — even though the underlying email record does carry the job.

For the candidate you're viewing: 3 sent-email activities exist, all 3 email records point at this job, and none of the 3 activities have `job_id` in their metadata. The same gap applies to received emails logged by the reply webhook. Automation activities from the new worker already include `job_id`, so they'll show up once real runs happen; there simply haven't been any yet for this candidate.

## What will change

1. **Show existing emails immediately.** The database function behind the feed gets a third match rule: an email activity counts for a job when its linked email record belongs to that job. No backfill needed for history to appear, but a one-off backfill will also stamp `job_id` onto existing email activities so they're fast to find.
2. **Write it correctly going forward.** The email sender and the inbound-reply handler include `job_id` in the activity metadata whenever the email is tied to a job.
3. **No visual changes.** The Activity tab, Emails tab, filters and counts stay exactly as designed; they'll just have the rows they were missing.

## Technical details

- `get_candidate_activities(p_candidate_id, p_job_id)`: add a UNION branch selecting activities where `activity_type IN ('candidate_email_sent','candidate_email_received','candidate_email_automated')` and `metadata->>'email_log_id'` matches an `email_logs` row with `candidate_id = p_candidate_id AND job_id = p_job_id`. Keep the two existing branches and the access checks unchanged.
- Backfill (one-off SQL): `UPDATE activities a SET metadata = a.metadata || jsonb_build_object('job_id', e.job_id::text) FROM email_logs e WHERE e.id::text = a.metadata->>'email_log_id' AND e.job_id IS NOT NULL AND a.metadata->>'job_id' IS NULL AND a.activity_type IN (...)`.
- `send-user-email`: add `job_id: request.job_id ?? logData?.job_id` (and `association_id` when resolved) to the `log_activity` metadata for both manual and automated sends.
- `process-candidate-reply-webhook`: add `job_id` from the matched association to the `candidate_email_received` metadata.
- Redeploy both edge functions. Frontend (`useActivityFeed`, registry, cards) needs no change.
