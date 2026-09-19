-- 1. Feedback columns
ALTER TABLE public.dossier_feedback
  ADD COLUMN IF NOT EXISTS reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sent_to TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dossier_feedback'::regclass AND contype = 'u'
  ) THEN
    ALTER TABLE public.dossier_feedback
      ADD CONSTRAINT dossier_feedback_share_id_key UNIQUE USING INDEX dossier_feedback_one_decision_per_share_idx;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dossier_feedback_share_id_idx ON public.dossier_feedback (share_id);

REVOKE ALL ON public.dossier_feedback FROM anon;
GRANT SELECT ON public.dossier_feedback TO authenticated;
GRANT ALL ON public.dossier_feedback TO service_role;

-- 2. The address the link was emailed to
ALTER TABLE public.dossier_shares ADD COLUMN IF NOT EXISTS sent_to TEXT;

-- 3. Verdict banner retirement markers
ALTER TABLE public.job_candidate_associations
  ADD COLUMN IF NOT EXISTS client_verdict_resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_verdict_resolved_by UUID;

-- 4. Activity event types
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'client_dossier_viewed';
ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'client_dossier_decision';

-- 5. Retirement helper
CREATE OR REPLACE FUNCTION public.resolve_client_verdict(_association_id UUID, _by UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.job_candidate_associations
     SET client_verdict_resolved_at = now(),
         client_verdict_resolved_by = _by
   WHERE id = _association_id
     AND client_verdict_resolved_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_client_verdict(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_resolve_client_verdict_on_association()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_verdict_resolved_at IS NOT NULL THEN RETURN NEW; END IF;
  IF (NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id)
     OR (LOWER(COALESCE(NEW.status,'')) IS DISTINCT FROM LOWER(COALESCE(OLD.status,''))
         AND LOWER(COALESCE(NEW.status,'')) IN ('rejected','withdrawn','hired'))
  THEN
    NEW.client_verdict_resolved_at := now();
    NEW.client_verdict_resolved_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_client_verdict_on_association ON public.job_candidate_associations;
CREATE TRIGGER resolve_client_verdict_on_association
BEFORE UPDATE ON public.job_candidate_associations
FOR EACH ROW EXECUTE FUNCTION public.tg_resolve_client_verdict_on_association();

CREATE OR REPLACE FUNCTION public.tg_resolve_client_verdict_on_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_candidate_association_id IS NOT NULL THEN
    PERFORM public.resolve_client_verdict(NEW.job_candidate_association_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_client_verdict_on_booking ON public.scheduled_bookings;
CREATE TRIGGER resolve_client_verdict_on_booking
AFTER INSERT ON public.scheduled_bookings
FOR EACH ROW EXECUTE FUNCTION public.tg_resolve_client_verdict_on_booking();

-- 6. View receipt now also writes the honest activity entry on the first open
CREATE OR REPLACE FUNCTION public.record_dossier_view(_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share RECORD;
  v_assoc RECORD;
  v_job RECORD;
BEGIN
  SELECT * INTO v_share FROM public.dossier_shares
   WHERE token = _token
     AND is_public = true
     AND deactivated_at IS NULL
     AND public.dossier_share_is_live(association_id);
  IF v_share IS NULL THEN RETURN; END IF;

  UPDATE public.dossier_shares
     SET view_count = view_count + 1,
         last_viewed_at = now()
   WHERE id = v_share.id;

  IF COALESCE(v_share.view_count, 0) = 0 THEN
    SELECT * INTO v_assoc FROM public.job_candidate_associations WHERE id = v_share.association_id;
    SELECT * INTO v_job FROM public.jobs WHERE id = v_assoc.job_id;
    IF v_job.created_by IS NOT NULL THEN
      INSERT INTO public.activities (
        user_id, organization_id, tenant_id, activity_type, title, description,
        metadata, entity_type, entity_id
      ) VALUES (
        v_job.created_by, v_job.organization_id, v_job.tenant_id,
        'client_dossier_viewed', 'Shared dossier opened',
        'First open of the link ' ||
          COALESCE('sent to ' || v_share.sent_to, 'we shared') || ' · no decision yet',
        jsonb_build_object(
          'job_id', v_assoc.job_id::text,
          'candidate_id', v_assoc.candidate_id::text,
          'dossier_share_id', v_share.id::text,
          'sent_to', v_share.sent_to,
          'actor_label', 'via the shared dossier'
        ),
        'candidate', v_assoc.candidate_id
      );
    END IF;
  END IF;
END;
$$;

-- 7. The decision recorder: anonymous-only path, via security definer
CREATE OR REPLACE FUNCTION public.record_dossier_decision(
  _token TEXT,
  _decision TEXT,
  _reasons TEXT[] DEFAULT '{}',
  _note TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_share RECORD;
  v_assoc RECORD;
  v_job RECORD;
  v_candidate_name TEXT;
  v_row RECORD;
  v_title TEXT;
  v_recipient UUID;
BEGIN
  IF _decision NOT IN ('interview_requested','not_a_fit') THEN
    RETURN jsonb_build_object('error', 'invalid_decision');
  END IF;

  SELECT * INTO v_share FROM public.dossier_shares
   WHERE token = _token
     AND is_public = true
     AND deactivated_at IS NULL
     AND public.dossier_share_is_live(association_id);
  IF v_share IS NULL THEN
    RETURN jsonb_build_object('error', 'not_available');
  END IF;

  IF EXISTS (SELECT 1 FROM public.dossier_feedback WHERE share_id = v_share.id) THEN
    RETURN jsonb_build_object('error', 'decision_already_recorded');
  END IF;

  SELECT * INTO v_assoc FROM public.job_candidate_associations WHERE id = v_share.association_id;
  SELECT * INTO v_job FROM public.jobs WHERE id = v_assoc.job_id;
  SELECT candidate_name INTO v_candidate_name FROM public.candidates WHERE id = v_assoc.candidate_id;

  BEGIN
    INSERT INTO public.dossier_feedback (share_id, decision, reasons, note, sent_to, user_agent)
    VALUES (
      v_share.id, _decision, COALESCE(_reasons, '{}'),
      NULLIF(BTRIM(COALESCE(_note, '')), ''), v_share.sent_to, LEFT(COALESCE(_user_agent, ''), 400)
    )
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'decision_already_recorded');
  END;

  v_title := CASE WHEN _decision = 'interview_requested'
    THEN 'Client requested an interview'
    ELSE 'Client marked ' || COALESCE(v_candidate_name, 'the candidate') || ' not a fit' END;

  IF v_job.created_by IS NOT NULL THEN
    INSERT INTO public.activities (
      user_id, organization_id, tenant_id, activity_type, title, description,
      metadata, entity_type, entity_id
    ) VALUES (
      v_job.created_by, v_job.organization_id, v_job.tenant_id,
      'client_dossier_decision', v_title,
      'Answered on the link ' || COALESCE('sent to ' || v_share.sent_to, 'we shared') ||
        ' · opened ' || GREATEST(COALESCE(v_share.view_count, 0), 1) || ' times',
      jsonb_build_object(
        'job_id', v_assoc.job_id::text,
        'candidate_id', v_assoc.candidate_id::text,
        'dossier_share_id', v_share.id::text,
        'decision', _decision,
        'reasons', to_jsonb(COALESCE(_reasons, '{}'::text[])),
        'note', NULLIF(BTRIM(COALESCE(_note, '')), ''),
        'sent_to', v_share.sent_to,
        'actor_label', 'via the shared dossier'
      ),
      'candidate', v_assoc.candidate_id
    );
  END IF;

  FOR v_recipient IN
    SELECT DISTINCT uid FROM (
      SELECT v_job.created_by AS uid
      UNION
      SELECT ja.user_id FROM public.job_assignments ja
       WHERE ja.job_id = v_assoc.job_id AND ja.role = 'recruiter' AND ja.deleted_at IS NULL
    ) r WHERE uid IS NOT NULL
  LOOP
    PERFORM public.emit_notification(
      v_recipient, v_job.tenant_id, 'mention'::notification_category, NULL,
      'Client', NULL, v_title, v_job.title,
      COALESCE(NULLIF(BTRIM(COALESCE(_note, '')), ''), 'Decision recorded from the shared dossier.'),
      'candidate', v_assoc.candidate_id, v_assoc.job_id, v_assoc.candidate_id,
      '/jobs/' || v_assoc.job_id::text || '/candidates/' || v_assoc.candidate_id::text || '?tab=job',
      jsonb_build_object('dossier_share_id', v_share.id, 'decision', _decision)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'decision', v_row.decision,
    'created_at', v_row.created_at,
    'reasons', to_jsonb(v_row.reasons),
    'note', v_row.note
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_dossier_decision(TEXT, TEXT, TEXT[], TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_dossier_decision(TEXT, TEXT, TEXT[], TEXT, TEXT) TO service_role;