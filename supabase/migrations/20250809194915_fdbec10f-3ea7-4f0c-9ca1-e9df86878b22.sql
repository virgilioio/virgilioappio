-- Allow validation rules to be attached to application fields (country_field_id must be nullable)
ALTER TABLE public.field_validation_rules
  ALTER COLUMN country_field_id DROP NOT NULL;