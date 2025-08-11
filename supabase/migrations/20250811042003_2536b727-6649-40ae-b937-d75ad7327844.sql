-- Resequence positions safely by first offsetting all positions to avoid unique conflicts
BEGIN;

-- Step 1: Temporarily move all positions out of the way
UPDATE public.job_hiring_stages
SET position = position + 10000,
    updated_at = now();

-- Step 2: Compute desired new positions (defaults first by priority)
WITH joined AS (
  SELECT 
    jhs.id,
    jhs.job_id,
    jhs.stage_id,
    jhs.position AS old_pos,
    js.is_default,
    COALESCE(js.stage_priority, 500) AS pri,
    js.created_at AS stage_created
  FROM public.job_hiring_stages jhs
  JOIN public.job_stages js ON js.id = jhs.stage_id
), ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY job_id 
      ORDER BY CASE WHEN is_default THEN 0 ELSE 1 END,
               pri ASC,
               stage_created ASC,
               old_pos ASC,
               stage_id ASC
    ) AS new_pos
  FROM joined
)
UPDATE public.job_hiring_stages jhs
SET position = r.new_pos,
    updated_at = now()
FROM ranked r
WHERE jhs.id = r.id;

COMMIT;