ALTER TABLE public.job_candidate_associations
  ADD COLUMN IF NOT EXISTS hire_start_date date;

CREATE OR REPLACE FUNCTION public.mark_hired(
  p_application_id uuid,
  p_opening_id uuid,
  p_start_date date,
  p_close_job boolean DEFAULT false
)
RETURNS TABLE(req_id text, openings_remaining integer, job_closed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job_id uuid;
  v_candidate_id uuid;
  v_org_id uuid;
  v_req_id text;
  v_existing_hire uuid;
  v_remaining integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to mark a candidate hired.';
  END IF;
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'Start date is required.';
  END IF;

  SELECT jca.job_id, jca.candidate_id, j.organization_id
    INTO v_job_id, v_candidate_id, v_org_id
  FROM public.job_candidate_associations jca
  JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_application_id
  FOR UPDATE OF jca;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Candidate application not found.';
  END IF;

  IF NOT (
    public.get_user_type_secure() = 'platform_admin'
    OR public.check_org_hierarchy_role_access(v_org_id, 'recruiter')
    OR public.is_user_assigned_to_job(v_job_id, v_user_id)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to mark this candidate hired.';
  END IF;

  SELECT jo.req_id, jo.hired_association_id
    INTO v_req_id, v_existing_hire
  FROM public.job_openings jo
  WHERE jo.id = p_opening_id
    AND jo.job_id = v_job_id
  FOR UPDATE;

  IF v_req_id IS NULL THEN
    RAISE EXCEPTION 'That opening does not belong to this job.';
  END IF;
  IF v_existing_hire IS NOT NULL AND v_existing_hire <> p_application_id THEN
    RAISE EXCEPTION '% was just filled — pick another opening.', v_req_id;
  END IF;

  UPDATE public.offer_letters
  SET opening_id = p_opening_id,
      updated_at = now()
  WHERE candidate_id = v_candidate_id
    AND job_id = v_job_id
    AND status NOT IN ('declined');

  UPDATE public.job_candidate_associations
  SET status = 'hired',
      hired_at = now(),
      hired_by = v_user_id,
      hire_start_date = p_start_date,
      opening_id = p_opening_id
  WHERE id = p_application_id;

  UPDATE public.job_openings
  SET hired_association_id = p_application_id,
      filled_at = now(),
      updated_at = now()
  WHERE id = p_opening_id;

  SELECT count(*)::integer
    INTO v_remaining
  FROM public.job_openings
  WHERE job_id = v_job_id
    AND hired_association_id IS NULL;

  IF p_close_job AND v_remaining = 0 THEN
    UPDATE public.jobs SET status = 'closed' WHERE id = v_job_id;
  END IF;

  INSERT INTO public.activities (
    user_id, organization_id, activity_type, title, description,
    metadata, entity_type, entity_id
  ) VALUES (
    v_user_id, v_org_id, 'candidate_status_changed',
    'Hired · filled ' || v_req_id,
    'Candidate marked hired and linked to opening ' || v_req_id || '.',
    jsonb_build_object(
      'candidateId', v_candidate_id,
      'jobId', v_job_id,
      'associationId', p_application_id,
      'openingId', p_opening_id,
      'reqId', v_req_id,
      'startDate', p_start_date
    ),
    'candidate', v_candidate_id
  );

  RETURN QUERY SELECT v_req_id, v_remaining, (p_close_job AND v_remaining = 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.unmark_hired(p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_job_id uuid;
  v_org_id uuid;
  v_opening_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to update this hire.';
  END IF;

  SELECT jca.job_id, j.organization_id, jca.opening_id
    INTO v_job_id, v_org_id, v_opening_id
  FROM public.job_candidate_associations jca
  JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_application_id
  FOR UPDATE OF jca;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Candidate application not found.';
  END IF;

  IF NOT (
    public.get_user_type_secure() = 'platform_admin'
    OR public.check_org_hierarchy_role_access(v_org_id, 'recruiter')
    OR public.is_user_assigned_to_job(v_job_id, v_user_id)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to update this hire.';
  END IF;

  IF v_opening_id IS NOT NULL THEN
    UPDATE public.job_openings
    SET hired_association_id = NULL,
        filled_at = NULL,
        updated_at = now()
    WHERE id = v_opening_id
      AND hired_association_id = p_application_id;
  END IF;

  UPDATE public.job_candidate_associations
  SET status = 'offer',
      hired_at = NULL,
      hired_by = NULL,
      hire_start_date = NULL
  WHERE id = p_application_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_hired(uuid, uuid, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_hired(uuid, uuid, date, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.unmark_hired(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unmark_hired(uuid) TO authenticated;