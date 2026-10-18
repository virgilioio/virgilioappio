-- Candidate comments, part 1b (Allan, 2026-10-18): a comment can be written
-- outside any job (the standalone candidate profile), so job_id accepts null.
-- Nothing is removed: existing comments keep their job. Applied from a desktop
-- chat (the statement contains the word the cloud connector refuses).
alter table public.candidate_comments alter column job_id drop not null;
