-- Phase 5 Security Hardening Migration
-- Fixes database security issues identified by Supabase linter

-- 1. Add missing RLS policies for tables without policies
-- Enable RLS on candidate_education if not already enabled
ALTER TABLE public.candidate_education ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for candidate_education
CREATE POLICY "Users can view education for accessible candidates"
ON public.candidate_education
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM job_candidates jc
    JOIN jobs j ON jc.job_id = j.id
    JOIN members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_education.candidate_id
    AND m.user_id = auth.uid()
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM job_candidates jc
    JOIN job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_education.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = candidate_education.candidate_id
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  )
);

-- Enable RLS on candidate_work_experience if not already enabled  
ALTER TABLE public.candidate_work_experience ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for candidate_work_experience
CREATE POLICY "Users can view work experience for accessible candidates"
ON public.candidate_work_experience
FOR SELECT
USING (
  get_user_type_secure() = 'platform_admin'
  OR EXISTS (
    SELECT 1 FROM job_candidates jc
    JOIN jobs j ON jc.job_id = j.id
    JOIN members m ON j.organization_id = m.organization_id
    WHERE jc.id = candidate_work_experience.candidate_id
    AND m.user_id = auth.uid()
    AND m.user_status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM job_candidates jc
    JOIN job_assignments ja ON jc.job_id = ja.job_id
    WHERE jc.id = candidate_work_experience.candidate_id
    AND ja.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM candidates c
    WHERE c.id = candidate_work_experience.candidate_id
    AND EXISTS (
      SELECT 1 FROM members m
      WHERE m.user_id = auth.uid()
      AND m.user_status = 'active'
    )
  )
);

-- 2. Fix search_path for database functions (security definer functions)
-- Update functions that have search_path issues

-- Fix assign_pipeline_position
CREATE OR REPLACE FUNCTION public.assign_pipeline_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  next_pos integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.pipeline_position IS NULL OR NEW.pipeline_position <= 0 THEN
      SELECT COALESCE(MAX(pipeline_position), 0) + 1
        INTO next_pos
      FROM public.job_candidate_associations
      WHERE job_id = NEW.job_id
        AND (current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id);
      NEW.pipeline_position := COALESCE(next_pos, 1);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id) THEN
    NEW.entered_stage_at := now();
    IF NEW.pipeline_position IS NULL OR NEW.pipeline_position <= 0 THEN
      SELECT COALESCE(MAX(pipeline_position), 0) + 1
        INTO next_pos
      FROM public.job_candidate_associations
      WHERE job_id = NEW.job_id
        AND (current_stage_id IS NOT DISTINCT FROM NEW.current_stage_id);
      NEW.pipeline_position := COALESCE(next_pos, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix categorize_skills
CREATE OR REPLACE FUNCTION public.categorize_skills(manual_skills text[], generated_skills jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $function$
DECLARE
  result jsonb := '{"technical": [], "tools": [], "industries": [], "titles": [], "soft": [], "certifications": []}'::jsonb;
  skill text;
  generated_skill jsonb;
BEGIN
  IF manual_skills IS NOT NULL THEN
    FOR skill IN SELECT unnest(manual_skills)
    LOOP
      result := jsonb_set(
        result, 
        '{technical}', 
        (result->'technical') || jsonb_build_object(
          'name', skill,
          'category', 'technical',
          'source', 'manual',
          'confidence', 1.0
        )
      );
    END LOOP;
  END IF;
  
  IF generated_skills IS NOT NULL THEN
    FOR generated_skill IN SELECT jsonb_array_elements(generated_skills)
    LOOP
      result := jsonb_set(
        result,
        concat('{', generated_skill->>'category', '}')::text[],
        (result->(generated_skill->>'category')) || generated_skill
      );
    END LOOP;
  END IF;
  
  RETURN result;
END;
$function$;

-- Fix handle_activities_updated_at
CREATE OR REPLACE FUNCTION public.handle_activities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix check_recursion_safety
CREATE OR REPLACE FUNCTION public.check_recursion_safety()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$function$;

-- 3. Document Postgres version upgrade recommendation
-- Current version may be outdated. Recommend upgrading to latest stable Postgres 15+
-- This requires manual action via Supabase Dashboard

COMMENT ON DATABASE postgres IS 'Security Note: Consider upgrading to Postgres 15+ for latest security patches and performance improvements. Check Supabase Dashboard for upgrade options.';