-- Find Phase 3 (2026-10-12): the activity and notification kinds a job
-- change uses. In their own migration so the main one can use them.

alter type public.activity_type add value if not exists 'candidate_job_changed';
alter type public.notification_category add value if not exists 'candidate_update';
