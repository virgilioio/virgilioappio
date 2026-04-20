-- Repair stuck hiring plan positions for job ab605dd1 (Growth & GTM Marketing Specialist)
-- Rows are stranded at temp positions (10001-10005, 20001) from a prior interrupted save.
-- Reassign them to 1..n based on their current position order.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC) AS new_pos
  FROM public.job_hiring_stages
  WHERE job_id = 'ab605dd1-0000-0000-0000-000000000000'::uuid
     OR job_id::text LIKE 'ab605dd1%'
)
UPDATE public.job_hiring_stages jhs
SET position = -ordered.new_pos
FROM ordered
WHERE jhs.id = ordered.id;

-- Flip negatives to positives now that we know there are no collisions
UPDATE public.job_hiring_stages
SET position = -position
WHERE position < 0
  AND (job_id::text LIKE 'ab605dd1%');