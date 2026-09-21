CREATE OR REPLACE FUNCTION public.merge_candidate_payload(
  p_surviving uuid,
  p_incoming jsonb,
  p_resolutions jsonb DEFAULT '{}'::jsonb,
  p_actor uuid DEFAULT NULL,
  p_merged uuid DEFAULT NULL,
  p_resume jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing        public.candidates;
  v_merged          public.candidates;
  v_keys            text[] := ARRAY[
    'candidate_name','email','phone','location_city','location_state','location_country',
    'current_job_title','company_current','linkedin_url','salary_amount','salary_currency',
    'salary_period','years_experience','profile_summary','source'
  ];
  v_key             text;
  v_existing_json   jsonb;
  v_new             jsonb := '{}'::jsonb;
  v_old_values      jsonb := '{}'::jsonb;
  v_applied         jsonb := '{}'::jsonb;
  v_inc             jsonb;
  v_cur             jsonb;
  v_choice          text;
  v_emails          text[];
  v_phones          text[];
  v_skills          text[];
  v_attachment_id   uuid;
  v_next_version    int;
  v_audit_id        uuid;
  v_row             record;
BEGIN
  SELECT * INTO v_existing FROM public.candidates WHERE id = p_surviving FOR UPDATE;
  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'surviving candidate not found';
  END IF;

  v_existing_json := to_jsonb(v_existing);
  v_emails := coalesce(v_existing.contact_emails, ARRAY[]::text[]);
  v_phones := coalesce(v_existing.contact_phones, ARRAY[]::text[]);

  FOREACH v_key IN ARRAY v_keys LOOP
    v_inc := p_incoming -> v_key;
    v_cur := v_existing_json -> v_key;

    IF v_inc IS NULL OR jsonb_typeof(v_inc) = 'null'
       OR (jsonb_typeof(v_inc) = 'string' AND btrim(v_inc #>> '{}') = '') THEN
      CONTINUE;
    END IF;

    IF v_cur IS NULL OR jsonb_typeof(v_cur) = 'null'
       OR (jsonb_typeof(v_cur) = 'string' AND btrim(v_cur #>> '{}') = '') THEN
      -- gap fill: incoming always wins, no decision needed
      v_new := v_new || jsonb_build_object(v_key, v_inc);
      v_applied := v_applied || jsonb_build_object(v_key, 'incoming');
      v_old_values := v_old_values || jsonb_build_object(v_key, v_cur);
      CONTINUE;
    END IF;

    IF (v_cur #>> '{}') = (v_inc #>> '{}') THEN
      CONTINUE; -- identical
    END IF;

    v_choice := coalesce(p_resolutions ->> v_key, 'existing');
    v_applied := v_applied || jsonb_build_object(v_key, v_choice);

    IF v_choice = 'incoming' THEN
      v_new := v_new || jsonb_build_object(v_key, v_inc);
      v_old_values := v_old_values || jsonb_build_object(v_key, v_cur);
      -- the displaced value survives as a secondary contact point
      IF v_key = 'email' THEN
        v_emails := v_emails || jsonb_build_object('type','other','email', v_cur #>> '{}', 'status','displaced_by_merge')::text;
      ELSIF v_key = 'phone' THEN
        v_phones := v_phones || jsonb_build_object('type','other','number', v_cur #>> '{}', 'raw_number', v_cur #>> '{}')::text;
      END IF;
    ELSE
      -- keeping the value on file; the incoming one is stored as secondary
      IF v_key = 'email' THEN
        v_emails := v_emails || jsonb_build_object('type','other','email', v_inc #>> '{}', 'status','from_merge')::text;
      ELSIF v_key = 'phone' THEN
        v_phones := v_phones || jsonb_build_object('type','other','number', v_inc #>> '{}', 'raw_number', v_inc #>> '{}')::text;
      END IF;
    END IF;
  END LOOP;

  -- skills union
  SELECT array_agg(DISTINCT s) INTO v_skills
  FROM (
    SELECT unnest(coalesce(v_existing.skills, ARRAY[]::text[])) AS s
    UNION
    SELECT jsonb_array_elements_text(coalesce(p_incoming -> 'skills', '[]'::jsonb)) AS s
  ) u
  WHERE btrim(s) <> '';

  UPDATE public.candidates c SET
    candidate_name    = coalesce(v_new ->> 'candidate_name', c.candidate_name),
    email             = coalesce(v_new ->> 'email', c.email),
    phone             = coalesce(v_new ->> 'phone', c.phone),
    location_city     = coalesce(v_new ->> 'location_city', c.location_city),
    location_state    = coalesce(v_new ->> 'location_state', c.location_state),
    location_country  = coalesce(v_new ->> 'location_country', c.location_country),
    current_job_title = coalesce(v_new ->> 'current_job_title', c.current_job_title),
    company_current   = coalesce(v_new ->> 'company_current', c.company_current),
    linkedin_url      = coalesce(v_new ->> 'linkedin_url', c.linkedin_url),
    salary_amount     = coalesce((v_new ->> 'salary_amount')::numeric, c.salary_amount),
    salary_currency   = coalesce(v_new ->> 'salary_currency', c.salary_currency),
    salary_period     = coalesce(v_new ->> 'salary_period', c.salary_period),
    years_experience  = coalesce((v_new ->> 'years_experience')::int, c.years_experience),
    profile_summary   = coalesce(v_new ->> 'profile_summary', c.profile_summary),
    source            = coalesce(v_new ->> 'source', c.source),
    contact_emails    = v_emails,
    contact_phones    = v_phones,
    skills            = coalesce(v_skills, c.skills),
    updated_at        = now()
  WHERE c.id = p_surviving;

  -- resume attached as a new version; nothing overwritten
  IF p_resume IS NOT NULL AND (p_resume ->> 'file_url') IS NOT NULL THEN
    SELECT coalesce(max(version), 0) + 1 INTO v_next_version
    FROM public.candidate_attachments WHERE candidate_id = p_surviving;

    INSERT INTO public.candidate_attachments
      (candidate_id, file_name, file_url, file_size_bytes, file_type, uploaded_by, is_resume, version)
    VALUES (
      p_surviving,
      p_resume ->> 'file_name',
      p_resume ->> 'file_url',
      nullif(p_resume ->> 'file_size_bytes','')::int,
      p_resume ->> 'file_type',
      p_actor,
      true,
      v_next_version
    )
    RETURNING id INTO v_attachment_id;

    UPDATE public.candidate_attachments
      SET is_resume = false, superseded_by = v_attachment_id
    WHERE candidate_id = p_surviving AND id <> v_attachment_id AND is_resume = true;
  END IF;

  -- record-to-record mode: nothing is deleted, everything is re-pointed
  IF p_merged IS NOT NULL AND p_merged <> p_surviving THEN
    SELECT * INTO v_merged FROM public.candidates WHERE id = p_merged FOR UPDATE;
    IF v_merged.id IS NULL THEN
      RAISE EXCEPTION 'merged candidate not found';
    END IF;
    IF v_merged.tenant_id IS DISTINCT FROM v_existing.tenant_id THEN
      RAISE EXCEPTION 'candidates belong to different tenants';
    END IF;

    -- collapse applications to the same job: keep the one that progressed furthest
    FOR v_row IN
      SELECT m.id AS merged_assoc, s.id AS surviving_assoc
      FROM public.job_candidate_associations m
      JOIN public.job_candidate_associations s
        ON s.job_id = m.job_id AND s.candidate_id = p_surviving
      WHERE m.candidate_id = p_merged
    LOOP
      UPDATE public.job_candidate_stage_history
        SET association_id = v_row.surviving_assoc
      WHERE association_id = v_row.merged_assoc;
      DELETE FROM public.job_candidate_associations WHERE id = v_row.merged_assoc;
    END LOOP;

    UPDATE public.job_candidate_associations SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_attachments      SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_comments         SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_work_experience  SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_education        SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_certifications   SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_urls             SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_tags             SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.candidate_reminders        SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.email_logs                 SET candidate_id = p_surviving WHERE candidate_id = p_merged;
    UPDATE public.activities                 SET candidate_id = p_surviving WHERE candidate_id = p_merged;

    UPDATE public.candidates
      SET merged_into = p_surviving,
          merged_at = now(),
          merged_by = p_actor,
          status = 'merged',
          updated_at = now()
    WHERE id = p_merged;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    p_actor,
    'candidate_merged',
    'candidates',
    p_surviving,
    jsonb_build_object('candidate', v_old_values, 'merged_candidate_id', p_merged),
    jsonb_build_object(
      'candidate', v_new,
      'resolutions', v_applied,
      'skills_after', coalesce(v_skills, ARRAY[]::text[]),
      'resume_attachment_id', v_attachment_id
    )
  )
  RETURNING id INTO v_audit_id;

  RETURN jsonb_build_object(
    'candidate_id', p_surviving,
    'audit_log_id', v_audit_id,
    'applied', v_applied,
    'skills_after', coalesce(v_skills, ARRAY[]::text[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_candidate_payload(uuid, jsonb, jsonb, uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_candidate_payload(uuid, jsonb, jsonb, uuid, uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.merge_candidate_payload(uuid, jsonb, jsonb, uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.merge_candidate_payload(uuid, jsonb, jsonb, uuid, uuid, jsonb) TO service_role;