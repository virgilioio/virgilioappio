-- Sync posting application fields order with global Application Fields order
-- 1) Function to resequence fields for a single posting: library fields first (ordered by application_fields.display_order), then custom fields preserving their relative order
CREATE OR REPLACE FUNCTION public.resequence_posting_fields_for_library_order(p_posting_id uuid)
RETURNS void
LANGUAGE plpgsql
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
    ORDER BY af.display_order ASC, af.created_at ASC
  LOOP
    rn := rn + 1;
    UPDATE public.job_posting_application_fields
    SET display_order = rn
    WHERE id = rec.id;
  END LOOP;

  -- Append custom fields after library fields, keeping their current relative order
  FOR rec IN
    SELECT f.id
    FROM public.job_posting_application_fields f
    WHERE f.posting_id = p_posting_id
      AND f.source = 'custom'
    ORDER BY f.display_order ASC, f.created_at ASC
  LOOP
    rn := rn + 1;
    UPDATE public.job_posting_application_fields
    SET display_order = rn
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 2) Function to run resequencing across all postings
CREATE OR REPLACE FUNCTION public.sync_all_postings_field_order()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  p record;
BEGIN
  FOR p IN SELECT id FROM public.job_postings LOOP
    PERFORM public.resequence_posting_fields_for_library_order(p.id);
  END LOOP;
END;
$$;

-- 3) Trigger to automatically sync whenever Application Fields order or default flag changes
DROP TRIGGER IF EXISTS trg_application_fields_order_changed ON public.application_fields;
CREATE TRIGGER trg_application_fields_order_changed
AFTER UPDATE OF display_order, is_default ON public.application_fields
FOR EACH STATEMENT EXECUTE FUNCTION public.sync_all_postings_field_order();

-- 4) Run an initial sync now so existing postings reflect the latest ordering
DO $$ BEGIN
  PERFORM public.sync_all_postings_field_order();
END $$;