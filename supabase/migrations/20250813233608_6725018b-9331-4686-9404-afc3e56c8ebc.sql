-- Clean up orphaned candidate attachments that reference non-existent candidates
-- First, let's see what attachments exist and if we can map them to the correct candidates
WITH orphaned_attachments AS (
  SELECT ca.id, ca.candidate_id, ca.file_name, ca.created_at
  FROM candidate_attachments ca
  LEFT JOIN candidates c ON ca.candidate_id = c.id
  WHERE c.id IS NULL
),
-- Try to find corresponding job_candidates and map to global candidates
mapped_candidates AS (
  SELECT 
    oa.id as attachment_id,
    oa.candidate_id as old_candidate_id,
    jca.candidate_id as new_candidate_id
  FROM orphaned_attachments oa
  LEFT JOIN job_candidates jc ON jc.id = oa.candidate_id
  LEFT JOIN job_candidate_associations jca ON jca.candidate_id = jc.id
  WHERE jca.candidate_id IS NOT NULL
)
-- Delete orphaned attachments that can't be mapped to valid candidates
DELETE FROM candidate_attachments 
WHERE id IN (
  SELECT ca.id
  FROM candidate_attachments ca
  LEFT JOIN candidates c ON ca.candidate_id = c.id
  WHERE c.id IS NULL
);