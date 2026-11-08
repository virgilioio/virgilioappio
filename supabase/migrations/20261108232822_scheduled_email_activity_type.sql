-- Scheduled emails in the Activity feed (2026-11-08), part 1 of 2.
-- A new kind of activity: one line per scheduled email, from the moment it's scheduled.
-- On its own so the value exists before part 2 writes it.
alter type public.activity_type add value if not exists 'candidate_email_scheduled';
