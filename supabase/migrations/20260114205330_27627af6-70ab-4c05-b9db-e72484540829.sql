-- Fix scheduled_bookings where association doesn't match candidate+job
-- This corrects any historical data integrity issues

UPDATE scheduled_bookings sb
SET job_candidate_association_id = jca.id
FROM job_candidate_associations jca
WHERE sb.candidate_id = jca.candidate_id
  AND sb.job_id = jca.job_id
  AND jca.status = 'active'
  AND sb.job_candidate_association_id IS DISTINCT FROM jca.id
  AND sb.candidate_id IS NOT NULL
  AND sb.job_id IS NOT NULL;

-- Fix booking_link_tokens similarly
UPDATE booking_link_tokens blt
SET association_id = jca.id
FROM job_candidate_associations jca
WHERE blt.candidate_id = jca.candidate_id
  AND blt.job_id = jca.job_id
  AND jca.status = 'active'
  AND blt.association_id IS DISTINCT FROM jca.id
  AND blt.candidate_id IS NOT NULL
  AND blt.job_id IS NOT NULL;