
-- ============================================================================
-- FIX REMAINING TRIGGER FUNCTIONS MISSING search_path
-- ============================================================================
-- These trigger functions are missing SET search_path, which is a security
-- vulnerability. Adding search_path protection to all trigger functions.
-- ============================================================================

-- 1. add_default_application_fields_to_posting
CREATE OR REPLACE FUNCTION public.add_default_application_fields_to_posting()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  rn int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT 
      af.id as application_field_id,
      af.field_name,
      af.field_label,
      af.field_type,
      af.placeholder_text,
      af.help_text,
      af.accepted_file_types,
      af.max_file_size_mb
    FROM public.application_fields af
    WHERE af.is_default = true 
      AND af.is_core_field = false  -- Only add non-core fields
    ORDER BY af.display_order, af.created_at
  LOOP
    rn := rn + 1;
    INSERT INTO public.job_posting_application_fields (
      posting_id,
      source,
      application_field_id,
      field_name,
      field_label,
      field_type,
      is_required,
      display_order,
      placeholder_text,
      help_text,
      accepted_file_types,
      max_file_size_mb,
      column_span
    ) VALUES (
      NEW.id,
      'library',
      r.application_field_id,
      r.field_name,
      r.field_label,
      r.field_type,
      true,   -- required by default for default fields
      rn,
      r.placeholder_text,
      r.help_text,
      r.accepted_file_types,
      r.max_file_size_mb,
      4
    );
  END LOOP;
  RETURN NEW;
END;
$function$;

-- 2. assign_posting_field_order
CREATE OR REPLACE FUNCTION public.assign_posting_field_order()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  next_pos integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.display_order IS NULL OR NEW.display_order <= 0 THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO next_pos
      FROM public.job_posting_application_fields
      WHERE posting_id = NEW.posting_id;
      NEW.display_order := COALESCE(next_pos, 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (NEW.posting_id IS DISTINCT FROM OLD.posting_id) THEN
    IF NEW.display_order IS NULL OR NEW.display_order <= 0 THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO next_pos
      FROM public.job_posting_application_fields
      WHERE posting_id = NEW.posting_id;
      NEW.display_order := COALESCE(next_pos, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. generate_job_posting_slug
CREATE OR REPLACE FUNCTION public.generate_job_posting_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  base text;
  candidate text;
  suffix text;
  tries int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := lower(regexp_replace(coalesce(NEW.title, 'job-posting'), '[^a-z0-9]+', '-', 'g'));
    base := regexp_replace(base, '-+', '-', 'g');
    base := regexp_replace(base, '(^-+|-+$)', '', 'g');
    IF base = '' THEN
      base := 'job-posting';
    END IF;
    LOOP
      suffix := substr(gen_random_uuid()::text, 1, 8);
      candidate := left(base, GREATEST(1, 60 - 1 - length(suffix))) || '-' || suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_postings WHERE slug = candidate);
      tries := tries + 1;
      IF tries > 5 THEN
        candidate := base || '-' || substr(gen_random_uuid()::text, 1, 12);
        EXIT;
      END IF;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. handle_updated_at (generic updated_at trigger)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 5. update_stage_interviewer_assignments_updated_at
CREATE OR REPLACE FUNCTION public.update_stage_interviewer_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE 
    n.nspname = 'public'
    AND (p.prosecdef = true OR p.prorettype = 'trigger'::regtype)
    AND (
      p.proconfig IS NULL 
      OR NOT EXISTS (
        SELECT 1 
        FROM unnest(p.proconfig) cfg 
        WHERE cfg LIKE 'search_path=%'
      )
    );
    
  RAISE NOTICE 'Functions missing search_path after fix: %', missing_count;
  
  IF missing_count = 0 THEN
    RAISE NOTICE '✅ SUCCESS: All functions now have search_path protection!';
  ELSE
    RAISE WARNING '⚠️ Still % functions without search_path', missing_count;
  END IF;
END $$;
