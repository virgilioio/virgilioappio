
-- 1) Enum for per-posting field source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'application_field_source' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.application_field_source AS ENUM ('library', 'custom');
  END IF;
END$$;

-- 2) Job postings table
CREATE TABLE IF NOT EXISTS public.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Slug generation function
CREATE OR REPLACE FUNCTION public.generate_job_posting_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  suffix text;
  tries int := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := lower(regexp_replace(coalesce(NEW.title, 'job-posting'), '[^a-z0-9]+', '-', 'g'));
    base := regexp_replace(base, '-+', '-', 'g');
    base := regexp_replace(base, '(^-+|-+$)', '', 'g');
    IF base = '' THEN
      base := 'job-posting';
    END IF;
    LOOP
      suffix := substr(gen_random_uuid()::text, 1, 8);
      candidate := left(base, GREATEST(1, 60 - 1 - length(suffix))) || '-' || suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_postings WHERE slug = candidate);
      tries := tries + 1;
      IF tries > 5 THEN
        candidate := base || '-' || substr(gen_random_uuid()::text, 1, 12);
        EXIT;
      END IF;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers for job_postings
DROP TRIGGER IF EXISTS trg_job_postings_set_updated_at ON public.job_postings;
CREATE TRIGGER trg_job_postings_set_updated_at
BEFORE UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_job_postings_generate_slug ON public.job_postings;
CREATE TRIGGER trg_job_postings_generate_slug
BEFORE INSERT ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.generate_job_posting_slug();

-- Row Level Security and policies for job_postings
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- Platform admins can manage all job postings
DROP POLICY IF EXISTS "Platform admins can manage all job postings - secure" ON public.job_postings;
CREATE POLICY "Platform admins can manage all job postings - secure"
  ON public.job_postings
  FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin')
  WITH CHECK (public.get_user_type_secure() = 'platform_admin');

-- Organization members can view their job postings
DROP POLICY IF EXISTS "Org members can view job postings" ON public.job_postings;
CREATE POLICY "Org members can view job postings"
  ON public.job_postings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_postings.job_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  );

-- Organization recruiters/admins can manage job postings
DROP POLICY IF EXISTS "Org recruiters can manage job postings" ON public.job_postings;
CREATE POLICY "Org recruiters can manage job postings"
  ON public.job_postings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_postings.job_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.jobs j
      JOIN public.members m ON j.organization_id = m.organization_id
      WHERE j.id = job_postings.job_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  );

-- Public can view active postings (for the public link)
DROP POLICY IF EXISTS "Public can view active job postings" ON public.job_postings;
CREATE POLICY "Public can view active job postings"
  ON public.job_postings
  FOR SELECT
  TO public
  USING (is_active = true);

-- 3) Job posting application fields
CREATE TABLE IF NOT EXISTS public.job_posting_application_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  source public.application_field_source NOT NULL,
  application_field_id uuid NULL REFERENCES public.application_fields(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type public.field_type NOT NULL DEFAULT 'text',
  is_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  placeholder_text text,
  help_text text,
  accepted_file_types text,
  max_file_size_mb integer DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (posting_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_jpaf_posting_id ON public.job_posting_application_fields(posting_id);
CREATE INDEX IF NOT EXISTS idx_jpaf_posting_order ON public.job_posting_application_fields(posting_id, display_order);

-- Auto-assign display order
CREATE OR REPLACE FUNCTION public.assign_posting_field_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_pos integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.display_order IS NULL OR NEW.display_order <= 0 THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO next_pos
      FROM public.job_posting_application_fields
      WHERE posting_id = NEW.posting_id;
      NEW.display_order := COALESCE(next_pos, 1);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND (NEW.posting_id IS DISTINCT FROM OLD.posting_id) THEN
    IF NEW.display_order IS NULL OR NEW.display_order <= 0 THEN
      SELECT COALESCE(MAX(display_order), 0) + 1
      INTO next_pos
      FROM public.job_posting_application_fields
      WHERE posting_id = NEW.posting_id;
      NEW.display_order := COALESCE(next_pos, 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jpaf_assign_order ON public.job_posting_application_fields;
CREATE TRIGGER trg_jpaf_assign_order
BEFORE INSERT OR UPDATE ON public.job_posting_application_fields
FOR EACH ROW EXECUTE FUNCTION public.assign_posting_field_order();

DROP TRIGGER IF EXISTS trg_jpaf_set_updated_at ON public.job_posting_application_fields;
CREATE TRIGGER trg_jpaf_set_updated_at
BEFORE UPDATE ON public.job_posting_application_fields
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS for job_posting_application_fields
ALTER TABLE public.job_posting_application_fields ENABLE ROW LEVEL SECURITY;

-- Public can view fields for active postings
DROP POLICY IF EXISTS "Public can view fields for active postings" ON public.job_posting_application_fields;
CREATE POLICY "Public can view fields for active postings"
  ON public.job_posting_application_fields
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      WHERE p.id = job_posting_application_fields.posting_id
        AND p.is_active = true
    )
  );

-- Org members can view fields for their postings
DROP POLICY IF EXISTS "Org members can view posting fields" ON public.job_posting_application_fields;
CREATE POLICY "Org members can view posting fields"
  ON public.job_posting_application_fields
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE p.id = job_posting_application_fields.posting_id
        AND m.user_id = auth.uid()
        AND m.user_status = 'active'
    )
  );

-- Org recruiters/admins can manage posting fields
DROP POLICY IF EXISTS "Org recruiters can manage posting fields" ON public.job_posting_application_fields;
CREATE POLICY "Org recruiters can manage posting fields"
  ON public.job_posting_application_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE p.id = job_posting_application_fields.posting_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE p.id = job_posting_application_fields.posting_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  );

-- Platform admins can manage all posting fields
DROP POLICY IF EXISTS "Platform admins can manage all posting fields - secure" ON public.job_posting_application_fields;
CREATE POLICY "Platform admins can manage all posting fields - secure"
  ON public.job_posting_application_fields
  FOR ALL
  USING (public.get_user_type_secure() = 'platform_admin')
  WITH CHECK (public.get_user_type_secure() = 'platform_admin');

-- 4) Per-posting select options (so library options can be overridden)
CREATE TABLE IF NOT EXISTS public.posting_field_select_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_field_id uuid NOT NULL REFERENCES public.job_posting_application_fields(id) ON DELETE CASCADE,
  option_value text NOT NULL,
  option_label text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfso_field_id ON public.posting_field_select_options(posting_field_id);

ALTER TABLE public.posting_field_select_options ENABLE ROW LEVEL SECURITY;

-- Public can view options for active postings
DROP POLICY IF EXISTS "Public can view select options for active postings" ON public.posting_field_select_options;
CREATE POLICY "Public can view select options for active postings"
  ON public.posting_field_select_options
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      WHERE f.id = posting_field_select_options.posting_field_id
        AND p.is_active = true
    )
  );

-- Org recruiters/admins can manage posting select options
DROP POLICY IF EXISTS "Org recruiters can manage posting select options" ON public.posting_field_select_options;
CREATE POLICY "Org recruiters can manage posting select options"
  ON public.posting_field_select_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE f.id = posting_field_select_options.posting_field_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE f.id = posting_field_select_options.posting_field_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  );

-- 5) Per-posting validation rules
CREATE TABLE IF NOT EXISTS public.posting_field_validation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_field_id uuid NOT NULL REFERENCES public.job_posting_application_fields(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_value text NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pfvr_field_id ON public.posting_field_validation_rules(posting_field_id);

ALTER TABLE public.posting_field_validation_rules ENABLE ROW LEVEL SECURITY;

-- Public can view validation rules for active postings (optional; needed if client validates client-side)
DROP POLICY IF EXISTS "Public can view validation rules for active postings" ON public.posting_field_validation_rules;
CREATE POLICY "Public can view validation rules for active postings"
  ON public.posting_field_validation_rules
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      WHERE f.id = posting_field_validation_rules.posting_field_id
        AND p.is_active = true
    )
  );

-- Org recruiters/admins can manage posting validation rules
DROP POLICY IF EXISTS "Org recruiters can manage posting validation rules" ON public.posting_field_validation_rules;
CREATE POLICY "Org recruiters can manage posting validation rules"
  ON public.posting_field_validation_rules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE f.id = posting_field_validation_rules.posting_field_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.job_postings p
      JOIN public.job_posting_application_fields f ON f.posting_id = p.id
      JOIN public.jobs j ON j.id = p.job_id
      JOIN public.members m ON m.organization_id = j.organization_id
      WHERE f.id = posting_field_validation_rules.posting_field_id
        AND m.user_id = auth.uid()
        AND m.member_role IN ('admin','recruiter')
        AND m.user_status = 'active'
    )
    OR public.get_user_type_secure() = 'platform_admin'
  );

-- 6) Auto-include default library fields when a posting is created
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
      max_file_size_mb
    ) VALUES (
      NEW.id,
      'library',
      r.application_field_id,
      r.field_name,
      r.field_label,
      r.field_type,
      false,                    -- required is a per-posting decision; default to false
      rn,
      r.placeholder_text,
      r.help_text,
      r.accepted_file_types,
      r.max_file_size_mb
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_postings_add_defaults ON public.job_postings;
CREATE TRIGGER trg_job_postings_add_defaults
AFTER INSERT ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.add_default_application_fields_to_posting();
