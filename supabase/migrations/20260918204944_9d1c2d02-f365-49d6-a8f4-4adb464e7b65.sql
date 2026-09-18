
-- ─────────────────────────────── dossier_shares ───────────────────────────────
CREATE TABLE public.dossier_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.job_candidate_associations(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(9), 'hex'),
  is_public boolean NOT NULL DEFAULT false,
  deactivated_at timestamptz,
  deactivated_reason text,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (association_id)
);

CREATE INDEX dossier_shares_live_token_idx ON public.dossier_shares (token) WHERE is_public = true;

GRANT SELECT, INSERT, UPDATE ON public.dossier_shares TO authenticated;
GRANT SELECT ON public.dossier_shares TO anon;
GRANT ALL ON public.dossier_shares TO service_role;

-- ────────────────────────────── dossier_feedback ──────────────────────────────
CREATE TABLE public.dossier_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.dossier_shares(id) ON DELETE CASCADE,
  decision text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dossier_feedback_share_idx ON public.dossier_feedback (share_id, created_at DESC);

GRANT SELECT ON public.dossier_feedback TO authenticated;
GRANT ALL ON public.dossier_feedback TO service_role;

-- ───────────────────────────────── helpers ────────────────────────────────────
-- Who may manage a share: exactly the people who can already see the association.
CREATE OR REPLACE FUNCTION public.dossier_share_can_manage(_association_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM job_candidate_associations a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.id = _association_id
      AND (
        get_user_type_secure() = 'platform_admin'
        OR is_user_assigned_to_job(a.job_id)
        OR user_has_org_hierarchy_access(j.organization_id)
      )
  )
$$;

-- The guarantee, independent of the tidy-up triggers: a share is only live while
-- the candidate is still in the process and the job is still open.
CREATE OR REPLACE FUNCTION public.dossier_share_is_live(_association_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM job_candidate_associations a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.id = _association_id
      AND a.rejected_at IS NULL
      AND COALESCE(a.status, 'active') <> 'rejected'
      AND j.status = 'open'
  )
$$;

-- ─────────────────────────────────── RLS ──────────────────────────────────────
ALTER TABLE public.dossier_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossier_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read dossier shares"
  ON public.dossier_shares FOR SELECT TO authenticated
  USING (public.dossier_share_can_manage(association_id));

CREATE POLICY "Team can create dossier shares"
  ON public.dossier_shares FOR INSERT TO authenticated
  WITH CHECK (public.dossier_share_can_manage(association_id));

CREATE POLICY "Team can update dossier shares"
  ON public.dossier_shares FOR UPDATE TO authenticated
  USING (public.dossier_share_can_manage(association_id))
  WITH CHECK (public.dossier_share_can_manage(association_id));

-- All four conditions. The trigger is the tidy-up; this policy is the guarantee.
CREATE POLICY "Visitors can read a live public dossier share"
  ON public.dossier_shares FOR SELECT TO anon
  USING (
    is_public = true
    AND deactivated_at IS NULL
    AND public.dossier_share_is_live(association_id)
  );

CREATE POLICY "Team can read dossier feedback"
  ON public.dossier_feedback FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dossier_shares s
    WHERE s.id = dossier_feedback.share_id
      AND public.dossier_share_can_manage(s.association_id)
  ));

-- ───────────────────────── manual toggle bookkeeping ──────────────────────────
CREATE OR REPLACE FUNCTION public.dossier_share_track_toggle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF OLD.is_public AND NOT NEW.is_public AND NEW.deactivated_at IS NOT DISTINCT FROM OLD.deactivated_at THEN
    NEW.deactivated_at := now();
    NEW.deactivated_reason := 'manual';
  ELSIF NOT OLD.is_public AND NEW.is_public THEN
    NEW.deactivated_at := NULL;
    NEW.deactivated_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_shares_track_toggle
  BEFORE UPDATE ON public.dossier_shares
  FOR EACH ROW EXECUTE FUNCTION public.dossier_share_track_toggle();

-- ───────────────────────────── auto-deactivation ──────────────────────────────
CREATE OR REPLACE FUNCTION public.deactivate_dossier_share_on_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'rejected' AND COALESCE(OLD.status, '') <> 'rejected')
     OR (NEW.rejected_at IS NOT NULL AND OLD.rejected_at IS NULL) THEN
    UPDATE dossier_shares
       SET is_public = false,
           deactivated_at = now(),
           deactivated_reason = 'candidate_rejected'
     WHERE association_id = NEW.id
       AND is_public = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_shares_deactivate_on_rejection
  AFTER UPDATE ON public.job_candidate_associations
  FOR EACH ROW EXECUTE FUNCTION public.deactivate_dossier_share_on_rejection();

CREATE OR REPLACE FUNCTION public.deactivate_dossier_shares_on_job_close()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('closed', 'archived') AND OLD.status <> NEW.status THEN
    UPDATE dossier_shares s
       SET is_public = false,
           deactivated_at = now(),
           deactivated_reason = 'job_closed'
     WHERE s.is_public = true
       AND s.association_id IN (
         SELECT a.id FROM job_candidate_associations a WHERE a.job_id = NEW.id
       );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dossier_shares_deactivate_on_job_close
  AFTER UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.deactivate_dossier_shares_on_job_close();

-- ───────────────────────────── view counter ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_dossier_view(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dossier_shares
     SET view_count = view_count + 1,
         last_viewed_at = now()
   WHERE token = _token
     AND is_public = true
     AND deactivated_at IS NULL
     AND dossier_share_is_live(association_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_dossier_view(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dossier_view(text) TO service_role;
