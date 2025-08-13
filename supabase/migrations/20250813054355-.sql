-- Ensure resequencing runs and auto-syncs when library field order changes

-- 1) Resequence function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.resequence_posting_fields_for_library_order(p_posting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  rn int := 0;
  rec record;
BEGIN
  -- Re-sequence library-sourced fields based on current library ordering
  FOR rec IN
    SELECT f.id
    FROM public.job_posting_application_fields f
    JOIN public.application_fields af ON af.id = f.application_field_id
    WHERE f.posting_id = p_posting_id
      AND f.source = 'library'
    ORDER BY af.display_order ASC, af.created_at ASC, af.id
  LOOP
    rn := rn + 1;
    UPDATE public.job_posting_application_fields
    SET display_order = rn, updated_at = now()
    WHERE id = rec.id;
  END LOOP;

  -- Append custom fields after library fields, keeping their current relative order
  FOR rec IN
    SELECT f.id
    FROM public.job_posting_application_fields f
    WHERE f.posting_id = p_posting_id
      AND f.source = 'custom'
    ORDER BY f.display_order ASC, f.created_at ASC, f.id
  LOOP
    rn := rn + 1;
    UPDATE public.job_posting_application_fields
    SET display_order = rn, updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 2) Sync all postings function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.sync_all_postings_field_order()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT id FROM public.job_postings LOOP
    PERFORM public.resequence_posting_fields_for_library_order(p.id);
  END LOOP;
END;
$$;

-- 3) Proper trigger function (RETURNS TRIGGER) to call sync on application_fields updates
CREATE OR REPLACE FUNCTION public.trg_sync_postings_on_app_fields_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.sync_all_postings_field_order();
  RETURN NULL; -- AFTER STATEMENT trigger, return value ignored
END;
$$;

-- 4) Replace the trigger with the proper trigger function
DROP TRIGGER IF EXISTS trg_application_fields_order_changed ON public.application_fields;
CREATE TRIGGER trg_application_fields_order_changed
AFTER UPDATE OF display_order, is_default ON public.application_fields
FOR EACH STATEMENT EXECUTE FUNCTION public.trg_sync_postings_on_app_fields_change();

-- 5) Run an immediate full resequence so existing postings reflect latest order
DO $$ BEGIN
  PERFORM public.sync_all_postings_field_order();
END $$;