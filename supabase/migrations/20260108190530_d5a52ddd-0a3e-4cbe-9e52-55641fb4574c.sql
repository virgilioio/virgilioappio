-- Complete the partial transfer for candidate a79a529d-4c4f-470a-a916-485351bacea7

-- 1. Move scheduled booking to target job/association
UPDATE scheduled_bookings
SET 
  job_id = 'bee1537d-9607-482c-8a15-496dfc4625a5',
  job_candidate_association_id = '51ef2781-55c7-4b5d-9123-ca42e849e4df'
WHERE id = 'e3e2cc54-63e2-4257-84a3-68e73ceb7f1c';

-- 2. Delete the old association from source job (Mid Market)
DELETE FROM job_candidate_associations
WHERE id = '98bfd6a3-71e9-446e-908d-1b16f686a863';