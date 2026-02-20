-- 1. Add tenant_id to candidate_application_limits
ALTER TABLE public.candidate_application_limits 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- 2. Backfill tenant_id from the job's organization
UPDATE public.candidate_application_limits cal
SET tenant_id = o.tenant_id
FROM public.jobs j
JOIN public.organizations o ON j.organization_id = o.id
WHERE cal.job_id = j.id
AND cal.tenant_id IS NULL;

-- 3. Update check_application_limits to scope by tenant_id
CREATE OR REPLACE FUNCTION public.check_application_limits(
  candidate_email_param text, 
  job_id_param uuid, 
  organization_id_param uuid,
  tenant_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  total_applications_60_days INTEGER;
  same_job_last_application TIMESTAMP WITH TIME ZONE;
  last_rejected_application TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Check total applications in last 60 days (scoped to this tenant+org)
  SELECT COUNT(*) INTO total_applications_60_days
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND organization_id = organization_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param)
    AND applied_at >= (now() - INTERVAL '60 days');
  
  -- Check last application to same job (scoped to this tenant)
  SELECT MAX(applied_at) INTO same_job_last_application
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND job_id = job_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param);
  
  -- Check last rejected application (scoped to this tenant+org)
  SELECT MAX(status_updated_at) INTO last_rejected_application
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND organization_id = organization_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param)
    AND status = 'rejected';
  
  -- Build result
  result := jsonb_build_object(
    'can_apply', true,
    'total_applications_60_days', total_applications_60_days,
    'max_applications_60_days', 3,
    'violations', jsonb_build_array()
  );
  
  IF total_applications_60_days >= 3 THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'max_applications_exceeded',
        'message', 'You have reached the maximum of 3 applications in the last 60 days'
      )
    );
  END IF;
  
  IF same_job_last_application IS NOT NULL AND same_job_last_application > (now() - INTERVAL '90 days') THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'same_job_cooldown',
        'message', 'You cannot reapply to the same job within 90 days',
        'cooldown_until', (same_job_last_application + INTERVAL '90 days')
      )
    );
  END IF;
  
  IF last_rejected_application IS NOT NULL AND last_rejected_application > (now() - INTERVAL '30 days') THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'rejection_cooldown',
        'message', 'You cannot apply within 30 days of a rejection',
        'cooldown_until', (last_rejected_application + INTERVAL '30 days')
      )
    );
  END IF;
  
  RETURN result;
END;
$$;