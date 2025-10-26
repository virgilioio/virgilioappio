-- Fix should_stop_automation() to check job_candidate_associations.status instead of candidates.status
-- This ensures automations are stopped based on job-specific status ('active', 'hired', 'rejected')
-- rather than general candidate status ('available', 'inactive')

CREATE OR REPLACE FUNCTION public.should_stop_automation(
  p_jca_id uuid,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_candidate_status text;
  v_job_status text;
BEGIN
  -- Get the job-specific candidate status from job_candidate_associations
  -- NOT the general candidate status from candidates table
  SELECT
    jca.status,  -- ✅ FIXED: Use job_candidate_associations.status
    j.status
  INTO
    v_candidate_status,
    v_job_status
  FROM public.job_candidate_associations jca
  JOIN public.candidates c ON c.id = jca.candidate_id
  JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_jca_id AND j.id = p_job_id;

  -- Stop automation if candidate is not 'active' in the job or job is not 'open'
  IF v_candidate_status != 'active' OR v_job_status != 'open' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$function$;