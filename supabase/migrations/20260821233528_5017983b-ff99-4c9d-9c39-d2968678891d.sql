ALTER TABLE public.reference_templates
  ALTER COLUMN privacy_notice_id TYPE text USING privacy_notice_id::text;