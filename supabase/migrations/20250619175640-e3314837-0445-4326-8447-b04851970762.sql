
-- Remove the conflicting jobs_select_policy that prevents assigned users from seeing jobs
-- The jobs_select_with_assignments policy is more comprehensive and handles all cases
DROP POLICY IF EXISTS "jobs_select_policy" ON public.jobs;
