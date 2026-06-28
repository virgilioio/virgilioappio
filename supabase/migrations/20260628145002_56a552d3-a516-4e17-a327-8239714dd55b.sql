-- Enums for EEO standard categories (US EEOC compliant)
DO $$ BEGIN
  CREATE TYPE public.eeo_gender AS ENUM ('male', 'female', 'non_binary', 'other', 'decline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eeo_race_ethnicity AS ENUM (
    'hispanic_latino',
    'white',
    'black_african_american',
    'native_hawaiian_pacific_islander',
    'asian',
    'american_indian_alaska_native',
    'two_or_more',
    'decline'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eeo_veteran_status AS ENUM (
    'not_veteran',
    'protected_veteran',
    'veteran_not_protected',
    'decline'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.eeo_disability_status AS ENUM ('yes', 'no', 'decline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop legacy anonymous artifacts if they were created previously
DROP FUNCTION IF EXISTS public.get_eeo_aggregate(uuid, uuid);
DROP TABLE IF EXISTS public.eeo_responses;

-- Main table
CREATE TABLE IF NOT EXISTS public.candidate_eeo_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  job_posting_id UUID NULL,
  gender public.eeo_gender NULL,
  race_ethnicity public.eeo_race_ethnicity NULL,
  veteran_status public.eeo_veteran_status NULL,
  disability_status public.eeo_disability_status NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT NULL,
  user_agent_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT candidate_eeo_responses_candidate_unique UNIQUE (candidate_id)
);

CREATE INDEX IF NOT EXISTS candidate_eeo_responses_tenant_idx
  ON public.candidate_eeo_responses (tenant_id);

-- GRANTs
-- INSERT allowed for anon so the public application edge function (running with anon key would still need this);
-- service_role is used in practice but we keep anon insert for resilience. SELECT/UPDATE/DELETE require RLS to pass.
GRANT INSERT ON public.candidate_eeo_responses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_eeo_responses TO authenticated;
GRANT ALL ON public.candidate_eeo_responses TO service_role;

ALTER TABLE public.candidate_eeo_responses ENABLE ROW LEVEL SECURITY;

-- Helper: who can view EEO data
CREATE OR REPLACE FUNCTION public.can_view_eeo(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.user_id = _user_id
      AND m.tenant_id = _tenant_id
      AND (
        m.user_type = 'platform_admin'
        OR m.user_type = 'workspace_owner'
        OR (m.user_type = 'member' AND m.system_role = 'admin')
      )
  )
  OR EXISTS (
    -- Platform admins may have cross-tenant scope
    SELECT 1 FROM public.members m
    WHERE m.user_id = _user_id
      AND m.user_type = 'platform_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_eeo(UUID, UUID) TO authenticated;

-- RLS Policies
DROP POLICY IF EXISTS "eeo_admins_select" ON public.candidate_eeo_responses;
CREATE POLICY "eeo_admins_select"
ON public.candidate_eeo_responses
FOR SELECT
TO authenticated
USING (public.can_view_eeo(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "eeo_admins_update" ON public.candidate_eeo_responses;
CREATE POLICY "eeo_admins_update"
ON public.candidate_eeo_responses
FOR UPDATE
TO authenticated
USING (public.can_view_eeo(auth.uid(), tenant_id))
WITH CHECK (public.can_view_eeo(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "eeo_admins_delete" ON public.candidate_eeo_responses;
CREATE POLICY "eeo_admins_delete"
ON public.candidate_eeo_responses
FOR DELETE
TO authenticated
USING (public.can_view_eeo(auth.uid(), tenant_id));

-- Public submission insert (anon role) — only allows insertions that link to an existing candidate
-- in the same tenant. Tenant_id and candidate_id are validated server-side by the edge function;
-- this policy is the defense-in-depth check.
DROP POLICY IF EXISTS "eeo_public_insert" ON public.candidate_eeo_responses;
CREATE POLICY "eeo_public_insert"
ON public.candidate_eeo_responses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = candidate_id
      AND c.tenant_id = candidate_eeo_responses.tenant_id
  )
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_eeo_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_eeo_updated_at ON public.candidate_eeo_responses;
CREATE TRIGGER trg_eeo_updated_at
BEFORE UPDATE ON public.candidate_eeo_responses
FOR EACH ROW EXECUTE FUNCTION public.update_eeo_updated_at();