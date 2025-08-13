-- Roll back auto-sync trigger to prevent unintended field changes on public posts
DROP TRIGGER IF EXISTS trg_application_fields_order_changed ON public.application_fields;
DROP FUNCTION IF EXISTS public.trg_sync_postings_on_app_fields_change();

-- Keep resequencing functions for manual use; no automatic propagation on library changes