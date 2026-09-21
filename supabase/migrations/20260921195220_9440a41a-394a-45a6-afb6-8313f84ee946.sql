CREATE TABLE public.candidate_duplicate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  match_email text,
  match_phone text,
  match_name text,
  other_candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'not_duplicate',
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_duplicate_decisions TO authenticated;
GRANT ALL ON public.candidate_duplicate_decisions TO service_role;

ALTER TABLE public.candidate_duplicate_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read duplicate decisions"
  ON public.candidate_duplicate_decisions FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members write duplicate decisions"
  ON public.candidate_duplicate_decisions FOR INSERT TO authenticated
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE UNIQUE INDEX candidate_duplicate_decisions_pair_idx
  ON public.candidate_duplicate_decisions (
    candidate_id,
    coalesce(other_candidate_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(match_email, ''),
    coalesce(match_phone, '')
  );

CREATE TRIGGER trg_cdd_updated_at BEFORE UPDATE ON public.candidate_duplicate_decisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_by uuid;

CREATE INDEX IF NOT EXISTS candidates_merged_into_idx
  ON public.candidates (merged_into) WHERE merged_into IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jca_one_per_candidate_job_idx
  ON public.job_candidate_associations (candidate_id, job_id);

ALTER TABLE public.candidate_attachments
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.candidate_attachments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;