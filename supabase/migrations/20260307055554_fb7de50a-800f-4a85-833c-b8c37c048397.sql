-- Hard delete 96 CSV-imported candidates (created 2026-03-07) and all related records

-- Delete related records first (foreign key dependencies)
DELETE FROM candidate_work_experience WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_education WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_certifications WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_attachments WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_comments WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_urls WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_reminders WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM candidate_application_responses WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM job_candidate_associations WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM email_logs WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));
DELETE FROM booking_link_tokens WHERE candidate_id IN (SELECT id FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire'));

-- Finally delete the candidates themselves
DELETE FROM candidates WHERE created_at >= '2026-03-07T05:19:00+00' AND deleted_at IS NULL AND source IN ('Talent', 'GoHire');