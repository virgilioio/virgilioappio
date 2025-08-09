-- Add 'url' to the shared field_type enum used by application_fields and country_fields
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'url';

-- Document intent
COMMENT ON TYPE public.field_type IS 'Enum for form field types such as text, number, email, textarea, select, checkbox, date, file, url';