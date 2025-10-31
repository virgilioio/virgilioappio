-- Fix ambiguous column references in is_user_assigned_to_job function
-- This allows recruiters to see their assigned jobs in the job selector

CREATE OR REPLACE FUNCTION public.is_user_assigned_to_job(job_id_param uuid, user_id_param uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.job_assignments ja
    WHERE ja.job_id = job_id_param 
      AND ja.user_id = user_id_param
  );
$function$;