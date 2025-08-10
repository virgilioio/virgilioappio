-- Make default seeded application fields required by default
CREATE OR REPLACE FUNCTION public.add_default_application_fields_to_posting()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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
$$;