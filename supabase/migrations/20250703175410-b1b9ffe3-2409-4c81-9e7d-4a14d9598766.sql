-- Make country_field_id nullable to support both country fields and offer template fields
ALTER TABLE public.field_select_options 
ALTER COLUMN country_field_id DROP NOT NULL;

-- Add a constraint to ensure either country_field_id OR offer_template_field_id is provided
ALTER TABLE public.field_select_options 
ADD CONSTRAINT field_select_options_reference_check 
CHECK (
  (country_field_id IS NOT NULL AND offer_template_field_id IS NULL) OR
  (country_field_id IS NULL AND offer_template_field_id IS NOT NULL)
);