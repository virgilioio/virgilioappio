CREATE TABLE public.job_pipeline_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.jobs(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT replace(replace(replace(encode(extensions.gen_random_bytes(18),'base64'),'+','-'),'/','_'),'=',''),
  is_public boolean NOT NULL DEFAULT false,
  from_stage_id uuid REFERENCES public.job_hiring_stages(id) ON DELETE SET NULL,
  show_fit_score boolean NOT NULL DEFAULT true,
  show_days boolean NOT NULL DEFAULT true,
  show_client_status boolean NOT NULL DEFAULT true,
  show_employer boolean NOT NULL DEFAULT true,
  initials_only boolean NOT NULL DEFAULT false,
  client_can_respond boolean NOT NULL DEFAULT true,
  show_scorecards boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.job_pipeline_shares TO authenticated;
GRANT ALL ON public.job_pipeline_shares TO service_role;
ALTER TABLE public.job_pipeline_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members read pipeline shares" ON public.job_pipeline_shares
FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.user_has_tenant_access(j.tenant_id)));
CREATE POLICY "Workspace members create pipeline shares" ON public.job_pipeline_shares
FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.user_has_tenant_access(j.tenant_id)));
CREATE POLICY "Workspace members update pipeline shares" ON public.job_pipeline_shares
FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND public.user_has_tenant_access(j.tenant_id)));

CREATE TRIGGER trg_job_pipeline_shares_updated BEFORE UPDATE ON public.job_pipeline_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only recruiting-process stages may start the client view.
CREATE OR REPLACE FUNCTION public.job_pipeline_share_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_type text; v_job uuid;
BEGIN
  IF NEW.from_stage_id IS NOT NULL THEN
    SELECT h.job_id, s.stage_type::text INTO v_job, v_type
      FROM job_hiring_stages h LEFT JOIN job_stages s ON s.id = h.stage_id WHERE h.id = NEW.from_stage_id;
    IF v_job IS DISTINCT FROM NEW.job_id OR v_type IN ('application','application_review','offer','onboarding') THEN
      RAISE EXCEPTION 'from_stage_id must be a recruiting stage of this job';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_job_pipeline_share_validate BEFORE INSERT OR UPDATE OF from_stage_id ON public.job_pipeline_shares
FOR EACH ROW EXECUTE FUNCTION public.job_pipeline_share_validate();

-- Rotate token (reset link).
CREATE OR REPLACE FUNCTION public.reset_job_pipeline_share_token(_share_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_pipeline_shares ps JOIN jobs j ON j.id = ps.job_id
                 WHERE ps.id = _share_id AND public.user_has_tenant_access(j.tenant_id)) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  v_token := replace(replace(replace(encode(gen_random_bytes(18),'base64'),'+','-'),'/','_'),'=','');
  UPDATE job_pipeline_shares SET token = v_token, view_count = 0, last_viewed_at = NULL WHERE id = _share_id;
  RETURN v_token;
END $$;
GRANT EXECUTE ON FUNCTION public.reset_job_pipeline_share_token(uuid) TO authenticated;

ALTER TABLE public.dossier_feedback ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dossier_link';

-- Decision from the pipeline link: same store, one decision per association.
CREATE OR REPLACE FUNCTION public.record_pipeline_decision(_token text, _association_id uuid, _decision text, _reasons text[] DEFAULT '{}', _note text DEFAULT NULL, _user_agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ps RECORD; v_assoc RECORD; v_job RECORD; v_share_id uuid; v_name text; v_row RECORD; v_title text; v_recipient uuid;
BEGIN
  IF _decision NOT IN ('interview_requested','not_a_fit') THEN RETURN jsonb_build_object('error','invalid_decision'); END IF;
  SELECT * INTO v_ps FROM job_pipeline_shares WHERE token = _token AND is_public AND client_can_respond;
  IF v_ps IS NULL THEN RETURN jsonb_build_object('error','not_available'); END IF;
  SELECT * INTO v_job FROM jobs WHERE id = v_ps.job_id AND status = 'open';
  IF v_job IS NULL THEN RETURN jsonb_build_object('error','not_available'); END IF;
  SELECT * INTO v_assoc FROM job_candidate_associations WHERE id = _association_id AND job_id = v_ps.job_id
    AND COALESCE(status,'') NOT IN ('rejected','withdrawn','hired');
  IF v_assoc IS NULL THEN RETURN jsonb_build_object('error','not_available'); END IF;

  SELECT id INTO v_share_id FROM dossier_shares WHERE association_id = _association_id;
  IF v_share_id IS NULL THEN
    INSERT INTO dossier_shares (association_id, created_by) VALUES (_association_id, v_ps.created_by) RETURNING id INTO v_share_id;
  END IF;
  IF EXISTS (SELECT 1 FROM dossier_feedback WHERE share_id = v_share_id) THEN
    RETURN jsonb_build_object('error','decision_already_recorded');
  END IF;
  SELECT candidate_name INTO v_name FROM candidates WHERE id = v_assoc.candidate_id;
  BEGIN
    INSERT INTO dossier_feedback (share_id, decision, reasons, note, user_agent, source)
    VALUES (v_share_id, _decision, COALESCE(_reasons,'{}'), NULLIF(BTRIM(COALESCE(_note,'')),''), LEFT(COALESCE(_user_agent,''),400), 'pipeline_link')
    RETURNING * INTO v_row;
  EXCEPTION WHEN unique_violation THEN RETURN jsonb_build_object('error','decision_already_recorded'); END;

  v_title := CASE WHEN _decision = 'interview_requested' THEN 'Client requested an interview'
    ELSE 'Client marked ' || COALESCE(v_name,'the candidate') || ' not a fit' END;
  IF v_job.created_by IS NOT NULL THEN
    INSERT INTO activities (user_id, organization_id, tenant_id, activity_type, title, description, metadata, entity_type, entity_id)
    VALUES (v_job.created_by, v_job.organization_id, v_job.tenant_id, 'client_dossier_decision', v_title,
      'Answered via the client pipeline',
      jsonb_build_object('job_id', v_job.id::text, 'candidate_id', v_assoc.candidate_id::text, 'dossier_share_id', v_share_id::text,
        'decision', _decision, 'reasons', to_jsonb(COALESCE(_reasons,'{}'::text[])), 'note', NULLIF(BTRIM(COALESCE(_note,'')),''),
        'source', 'pipeline_link', 'actor_label', 'via the client pipeline'),
      'candidate', v_assoc.candidate_id);
  END IF;
  FOR v_recipient IN SELECT DISTINCT uid FROM (SELECT v_job.created_by AS uid UNION
      SELECT ja.user_id FROM job_assignments ja WHERE ja.job_id = v_job.id AND ja.role = 'recruiter' AND ja.deleted_at IS NULL) r WHERE uid IS NOT NULL
  LOOP
    PERFORM public.emit_notification(v_recipient, v_job.tenant_id, 'mention'::notification_category, NULL, 'Client', NULL, v_title, v_job.title,
      COALESCE(NULLIF(BTRIM(COALESCE(_note,'')),''), 'Decision recorded from the client pipeline.'),
      'candidate', v_assoc.candidate_id, v_job.id, v_assoc.candidate_id,
      '/jobs/' || v_job.id::text || '/candidates/' || v_assoc.candidate_id::text || '?tab=job',
      jsonb_build_object('dossier_share_id', v_share_id, 'decision', _decision, 'source', 'pipeline_link'));
  END LOOP;
  RETURN jsonb_build_object('id', v_row.id, 'decision', v_row.decision, 'created_at', v_row.created_at, 'reasons', to_jsonb(v_row.reasons), 'note', v_row.note);
END $$;
REVOKE ALL ON FUNCTION public.record_pipeline_decision(text, uuid, text, text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pipeline_decision(text, uuid, text, text[], text, text) TO service_role;