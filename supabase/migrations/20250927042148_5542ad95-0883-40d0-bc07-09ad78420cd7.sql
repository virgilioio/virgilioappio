-- Drop country and compliance related tables in correct order

-- Drop organization custom data first (has foreign keys)
DROP TABLE IF EXISTS public.organization_custom_data CASCADE;

-- Drop field validation rules (references country_fields)
DROP TABLE IF EXISTS public.field_validation_rules CASCADE;

-- Drop field select options (references country_fields) 
DROP TABLE IF EXISTS public.field_select_options CASCADE;

-- Drop country fields (references countries)
DROP TABLE IF EXISTS public.country_fields CASCADE;

-- Drop countries base table
DROP TABLE IF EXISTS public.countries CASCADE;

-- Update organizations table to remove country reference
ALTER TABLE public.organizations 
DROP COLUMN IF EXISTS country CASCADE;