-- Execute the priority-respecting backfill to add any missing default stages to all existing jobs
-- This will append missing defaults at the end, but in the correct relative order
SELECT public.backfill_default_stages_to_all_jobs() AS stages_added;