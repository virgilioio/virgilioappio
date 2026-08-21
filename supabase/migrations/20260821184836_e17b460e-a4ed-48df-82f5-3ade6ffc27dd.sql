-- PART A: enums
CREATE TYPE public.reference_answer_type AS ENUM ('short_text','long_text','single_select','multi_select','yes_no','rating_1_5','section_header','employment_verification','would_rehire','recommendation_score');
CREATE TYPE public.reference_request_state AS ENUM ('draft','candidate','referees','partial','complete','attention','expired','cancelled');
CREATE TYPE public.referee_status AS ENUM ('pending','invited','opened','in_progress','submitted','declined','bounced','on_hold','logged');
CREATE TYPE public.reference_template_scope AS ENUM ('default','client','personalised');
CREATE TYPE public.referee_source AS ENUM ('candidate','recruiter_logged');

-- PART B: tables
CREATE TABLE public.reference_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  scope public.reference_template_scope NOT NULL DEFAULT 'default',
  client_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  is_live boolean NOT NULL DEFAULT false,
  min_referees integer NOT NULL DEFAULT 2,
  max_referees integer NOT NULL DEFAULT 3,
  relationship_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  referee_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_email jsonb,
  referee_email jsonb,
  candidate_link_days integer NOT NULL DEFAULT 14,
  referee_link_days integer NOT NULL DEFAULT 21,
  reminders jsonb,
  consent_text text,
  retention_months integer NOT NULL DEFAULT 24,
  privacy_notice_id uuid,
  times_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.reference_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.reference_templates(id) ON DELETE SET NULL,
  template_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  stage text,
  requested_by uuid,
  min_referees_override integer,
  state public.reference_request_state NOT NULL DEFAULT 'draft',
  flagged boolean NOT NULL DEFAULT false,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  candidate_token_hash text,
  candidate_link_expires_at timestamptz,
  consent_recorded_at timestamptz,
  self_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reference_referees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.reference_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  title text,
  relationship text,
  period text,
  on_hold boolean NOT NULL DEFAULT false,
  hold_note text,
  status public.referee_status NOT NULL DEFAULT 'pending',
  token_hash text,
  link_expires_at timestamptz,
  invited_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  source public.referee_source NOT NULL DEFAULT 'candidate',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reference_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.reference_requests(id) ON DELETE CASCADE,
  type text NOT NULL,
  label text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reference_templates_tenant ON public.reference_templates(tenant_id);
CREATE INDEX idx_reference_requests_tenant ON public.reference_requests(tenant_id);
CREATE INDEX idx_reference_requests_candidate ON public.reference_requests(candidate_id);
CREATE INDEX idx_reference_requests_job ON public.reference_requests(job_id);
CREATE INDEX idx_reference_requests_state ON public.reference_requests(state);
CREATE INDEX idx_reference_referees_request ON public.reference_referees(request_id);
CREATE INDEX idx_reference_referees_status ON public.reference_referees(status);
CREATE INDEX idx_reference_activity_request_created ON public.reference_activity(request_id, created_at);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_templates TO authenticated;
GRANT ALL ON public.reference_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_requests TO authenticated;
GRANT ALL ON public.reference_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_referees TO authenticated;
GRANT ALL ON public.reference_referees TO service_role;
GRANT SELECT, INSERT ON public.reference_activity TO authenticated;
GRANT ALL ON public.reference_activity TO service_role;

-- PART C: RLS
ALTER TABLE public.reference_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_referees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY reference_templates_select ON public.reference_templates FOR SELECT TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_templates_insert ON public.reference_templates FOR INSERT TO authenticated
  WITH CHECK (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_templates_update ON public.reference_templates FOR UPDATE TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id())
  WITH CHECK (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_templates_delete ON public.reference_templates FOR DELETE TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());

CREATE POLICY reference_requests_select ON public.reference_requests FOR SELECT TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_requests_insert ON public.reference_requests FOR INSERT TO authenticated
  WITH CHECK (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_requests_update ON public.reference_requests FOR UPDATE TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id())
  WITH CHECK (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());
CREATE POLICY reference_requests_delete ON public.reference_requests FOR DELETE TO authenticated
  USING (get_user_type_secure() = 'platform_admin' OR tenant_id = get_user_tenant_id());

CREATE POLICY reference_referees_select ON public.reference_referees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_referees.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));
CREATE POLICY reference_referees_insert ON public.reference_referees FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_referees.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));
CREATE POLICY reference_referees_update ON public.reference_referees FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_referees.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_referees.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));
CREATE POLICY reference_referees_delete ON public.reference_referees FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_referees.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));

CREATE POLICY reference_activity_select ON public.reference_activity FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_activity.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));
CREATE POLICY reference_activity_insert ON public.reference_activity FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.reference_requests r WHERE r.id = reference_activity.request_id
    AND (get_user_type_secure() = 'platform_admin' OR r.tenant_id = get_user_tenant_id())));

-- updated_at triggers (reuse existing helper)
CREATE TRIGGER trg_reference_templates_updated_at BEFORE UPDATE ON public.reference_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reference_requests_updated_at BEFORE UPDATE ON public.reference_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reference_referees_updated_at BEFORE UPDATE ON public.reference_referees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();