-- 1) Create application_fields table
CREATE TABLE IF NOT EXISTS public.application_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  placeholder_text text NULL,
  help_text text NULL,
  accepted_file_types text NULL,
  max_file_size_mb integer NULL DEFAULT 5,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.application_fields ENABLE ROW LEVEL SECURITY;

-- Policies: platform admins only
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_fields' AND policyname = 'Platform admins can view application fields'
  ) THEN
    CREATE POLICY "Platform admins can view application fields"
    ON public.application_fields
    FOR SELECT
    USING (public.get_user_type_secure() = 'platform_admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'application_fields' AND policyname = 'Platform admins can manage application fields'
  ) THEN
    CREATE POLICY "Platform admins can manage application fields"
    ON public.application_fields
    FOR ALL
    USING (public.get_user_type_secure() = 'platform_admin')
    WITH CHECK (public.get_user_type_secure() = 'platform_admin');
  END IF;
END $$;

-- Trigger to maintain updated_at
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'handle_application_fields_updated_at'
  ) THEN
    CREATE TRIGGER handle_application_fields_updated_at
    BEFORE UPDATE ON public.application_fields
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- 2) Link select options and validation rules to application_fields
ALTER TABLE public.field_select_options
  ADD COLUMN IF NOT EXISTS application_field_id uuid REFERENCES public.application_fields(id) ON DELETE CASCADE;

ALTER TABLE public.field_validation_rules
  ADD COLUMN IF NOT EXISTS application_field_id uuid REFERENCES public.application_fields(id) ON DELETE CASCADE;

-- 3) Ensure exactly one FK is set on field_select_options
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'field_select_options_single_parent_fk'
  ) THEN
    ALTER TABLE public.field_select_options
    ADD CONSTRAINT field_select_options_single_parent_fk
    CHECK (
      ((country_field_id IS NOT NULL)::int + (offer_template_field_id IS NOT NULL)::int + (application_field_id IS NOT NULL)::int) = 1
    );
  END IF;
END $$;

-- 4) Ensure exactly one FK is set on field_validation_rules
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'field_validation_rules_single_parent_fk'
  ) THEN
    ALTER TABLE public.field_validation_rules
    ADD CONSTRAINT field_validation_rules_single_parent_fk
    CHECK (
      ((country_field_id IS NOT NULL)::int + (offer_template_field_id IS NOT NULL)::int + (application_field_id IS NOT NULL)::int) = 1
    );
  END IF;
END $$;