-- Ensure default application fields (first/last/email/phone/linkedin) exist and are default

-- 1) Insert defaults if missing
INSERT INTO public.application_fields (field_name, field_label, field_type, is_default, is_required, display_order, placeholder_text)
SELECT 'first_name', 'First Name', 'text', true, false, 20, 'Your first name'
WHERE NOT EXISTS (SELECT 1 FROM public.application_fields WHERE field_name = 'first_name');

INSERT INTO public.application_fields (field_name, field_label, field_type, is_default, is_required, display_order, placeholder_text)
SELECT 'last_name', 'Last Name', 'text', true, false, 21, 'Your last name'
WHERE NOT EXISTS (SELECT 1 FROM public.application_fields WHERE field_name = 'last_name');

INSERT INTO public.application_fields (field_name, field_label, field_type, is_default, is_required, display_order, placeholder_text)
SELECT 'email', 'Email Address', 'email', true, false, 22, 'you@example.com'
WHERE NOT EXISTS (SELECT 1 FROM public.application_fields WHERE field_name = 'email');

INSERT INTO public.application_fields (field_name, field_label, field_type, is_default, is_required, display_order, placeholder_text)
SELECT 'phone', 'Phone Number', 'number', true, false, 23, '+1 555 123 4567'
WHERE NOT EXISTS (SELECT 1 FROM public.application_fields WHERE field_name = 'phone');

INSERT INTO public.application_fields (field_name, field_label, field_type, is_default, is_required, display_order, placeholder_text)
SELECT 'linkedin_url', 'LinkedIn Profile', 'url', true, false, 24, 'https://linkedin.com/in/username'
WHERE NOT EXISTS (SELECT 1 FROM public.application_fields WHERE field_name = 'linkedin_url');

-- 2) Force them to be defaults (respect existing display_order)
UPDATE public.application_fields
SET is_default = true
WHERE field_name IN ('first_name','last_name','email','phone','linkedin_url');

-- 3) Backfill missing default fields into existing postings (without duplicating)
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
)
SELECT 
  jp.id,
  'library',
  af.id,
  af.field_name,
  af.field_label,
  af.field_type,
  true,
  af.display_order,
  af.placeholder_text,
  af.help_text,
  af.accepted_file_types,
  af.max_file_size_mb,
  4
FROM public.job_postings jp
CROSS JOIN public.application_fields af
WHERE af.is_default = true
AND NOT EXISTS (
  SELECT 1
  FROM public.job_posting_application_fields f
  WHERE f.posting_id = jp.id
    AND f.application_field_id = af.id
);
