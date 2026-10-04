-- A person can hold several roles on a job (e.g. Sourcer and Recruiter).
alter table public.job_assignments drop constraint if exists job_assignments_job_id_user_id_key;
alter table public.job_assignments drop constraint if exists job_assignments_job_user_unique;
alter table public.job_assignments add constraint job_assignments_job_user_role_key unique (job_id, user_id, role);

-- Each hire credits exactly one Sourcer and one Recruiter.
alter table public.job_openings
  add column if not exists sourcer_user_id uuid references auth.users(id),
  add column if not exists recruiter_user_id uuid references auth.users(id);

-- Sales and Engagement Specialist for jobs that came from a Gio Sales deal.
-- Shape: {"sales":[{"id","name","email"}], "es":[{"id","name","email"}]}. Written only by Gio Sales (service role).
alter table public.jobs add column if not exists sales_team jsonb;

create or replace function public.jobs_protect_sales_team() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sales_team is distinct from old.sales_team and auth.uid() is not null then
    raise exception 'Sales and Engagement Specialist are set on the deal in Gio Sales.';
  end if;
  return new;
end $$;
drop trigger if exists jobs_protect_sales_team on public.jobs;
create trigger jobs_protect_sales_team before update of sales_team on public.jobs
  for each row execute function public.jobs_protect_sales_team();

-- {id, name, email} for an ATS user.
create or replace function public.ats_person(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when p_user is null then null else (
    select jsonb_build_object('id', p.user_id,
                              'name', trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')),
                              'email', p.email)
    from public.profiles p where p.user_id = p_user) end
$$;

-- Publish gate: draft -> open needs the full team.
create or replace function public.jobs_publish_gate() returns trigger
language plpgsql security definer set search_path = public as $$
declare missing text[] := '{}';
begin
  if new.status = 'open' and old.status = 'draft' then
    if not exists (select 1 from public.job_assignments a where a.job_id = new.id and a.role = 'sourcer' and a.deleted_at is null) then
      missing := missing || 'a Sourcer'; end if;
    if not exists (select 1 from public.job_assignments a where a.job_id = new.id and a.role = 'recruiter' and a.deleted_at is null) then
      missing := missing || 'a Recruiter'; end if;
    if new.sales_deal_id is not null then
      if jsonb_array_length(coalesce(new.sales_team -> 'sales', '[]'::jsonb)) = 0 then missing := missing || 'Sales'; end if;
      if jsonb_array_length(coalesce(new.sales_team -> 'es', '[]'::jsonb)) = 0 then missing := missing || 'an Engagement Specialist'; end if;
    end if;
    if array_length(missing, 1) > 0 then
      raise exception 'Assign % before publishing.', array_to_string(missing, ', ');
    end if;
  end if;
  return new;
end $$;
drop trigger if exists jobs_publish_gate on public.jobs;
create trigger jobs_publish_gate before update of status on public.jobs
  for each row execute function public.jobs_publish_gate();

drop function if exists public.mark_hired(uuid, uuid, date, boolean);
create function public.mark_hired(p_application_id uuid, p_opening_id uuid, p_start_date date,
                                  p_close_job boolean default false,
                                  p_sourcer_id uuid default null, p_recruiter_id uuid default null)
 returns table(req_id text, openings_remaining integer, job_closed boolean)
 language plpgsql set search_path to 'public' as $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_job_id uuid; v_candidate_id uuid; v_org_id uuid; v_req_id text; v_existing_hire uuid; v_remaining integer;
  v_sourcer uuid := p_sourcer_id; v_recruiter uuid := p_recruiter_id; v_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to mark a candidate hired.'; END IF;
  IF p_start_date IS NULL THEN RAISE EXCEPTION 'Start date is required.'; END IF;

  SELECT jca.job_id, jca.candidate_id, j.organization_id INTO v_job_id, v_candidate_id, v_org_id
  FROM public.job_candidate_associations jca JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_application_id FOR UPDATE OF jca;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'Candidate application not found.'; END IF;

  IF NOT (public.get_user_type_secure() = 'platform_admin'
          OR public.check_org_hierarchy_role_access(v_org_id, 'recruiter')
          OR public.is_user_assigned_to_job(v_job_id, v_user_id)) THEN
    RAISE EXCEPTION 'You do not have permission to mark this candidate hired.';
  END IF;

  IF v_sourcer IS NULL THEN
    SELECT array_agg(a.user_id) INTO v_ids FROM public.job_assignments a
     WHERE a.job_id = v_job_id AND a.role = 'sourcer' AND a.deleted_at IS NULL;
    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN v_sourcer := v_ids[1]; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.job_assignments a WHERE a.job_id = v_job_id AND a.user_id = v_sourcer
                    AND a.role = 'sourcer' AND a.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'That person is not a Sourcer on this job.';
  END IF;
  IF v_sourcer IS NULL THEN
    RAISE EXCEPTION 'Choose the Sourcer for this hire (assign one to the job first if none is listed).';
  END IF;

  IF v_recruiter IS NULL THEN
    SELECT array_agg(a.user_id) INTO v_ids FROM public.job_assignments a
     WHERE a.job_id = v_job_id AND a.role = 'recruiter' AND a.deleted_at IS NULL;
    IF coalesce(array_length(v_ids, 1), 0) = 1 THEN v_recruiter := v_ids[1]; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.job_assignments a WHERE a.job_id = v_job_id AND a.user_id = v_recruiter
                    AND a.role = 'recruiter' AND a.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'That person is not a Recruiter on this job.';
  END IF;
  IF v_recruiter IS NULL THEN
    RAISE EXCEPTION 'Choose the Recruiter for this hire (assign one to the job first if none is listed).';
  END IF;

  SELECT jo.req_id, jo.hired_association_id INTO v_req_id, v_existing_hire
  FROM public.job_openings jo WHERE jo.id = p_opening_id AND jo.job_id = v_job_id FOR UPDATE;
  IF v_req_id IS NULL THEN RAISE EXCEPTION 'That opening does not belong to this job.'; END IF;
  IF v_existing_hire IS NOT NULL AND v_existing_hire <> p_application_id THEN
    RAISE EXCEPTION '% was just filled — pick another opening.', v_req_id;
  END IF;

  UPDATE public.offer_letters SET opening_id = p_opening_id, updated_at = now()
  WHERE candidate_id = v_candidate_id AND job_id = v_job_id AND status NOT IN ('declined');

  UPDATE public.job_candidate_associations
  SET status = 'hired', hired_at = now(), hired_by = v_user_id, hire_start_date = p_start_date, opening_id = p_opening_id
  WHERE id = p_application_id;

  UPDATE public.job_openings
  SET hired_association_id = p_application_id, filled_at = now(), updated_at = now(),
      sourcer_user_id = v_sourcer, recruiter_user_id = v_recruiter
  WHERE id = p_opening_id;

  SELECT count(*)::integer INTO v_remaining FROM public.job_openings
  WHERE job_id = v_job_id AND hired_association_id IS NULL;
  IF p_close_job AND v_remaining = 0 THEN UPDATE public.jobs SET status = 'closed' WHERE id = v_job_id; END IF;

  INSERT INTO public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id)
  VALUES (v_user_id, v_org_id, 'candidate_status_changed', 'Hired · filled ' || v_req_id,
          'Candidate marked hired and linked to opening ' || v_req_id || '.',
          jsonb_build_object('candidateId', v_candidate_id, 'jobId', v_job_id, 'associationId', p_application_id,
                             'openingId', p_opening_id, 'reqId', v_req_id, 'startDate', p_start_date,
                             'sourcerId', v_sourcer, 'recruiterId', v_recruiter),
          'candidate', v_candidate_id);

  RETURN QUERY SELECT v_req_id, v_remaining, (p_close_job AND v_remaining = 0);
END;
$function$;

create or replace function public.unmark_hired(p_application_id uuid) returns void
 language plpgsql set search_path to 'public' as $function$
DECLARE v_user_id uuid := auth.uid(); v_job_id uuid; v_org_id uuid; v_opening_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to update this hire.'; END IF;
  SELECT jca.job_id, j.organization_id, jca.opening_id INTO v_job_id, v_org_id, v_opening_id
  FROM public.job_candidate_associations jca JOIN public.jobs j ON j.id = jca.job_id
  WHERE jca.id = p_application_id FOR UPDATE OF jca;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'Candidate application not found.'; END IF;
  IF NOT (public.get_user_type_secure() = 'platform_admin'
          OR public.check_org_hierarchy_role_access(v_org_id, 'recruiter')
          OR public.is_user_assigned_to_job(v_job_id, v_user_id)) THEN
    RAISE EXCEPTION 'You do not have permission to update this hire.';
  END IF;
  IF v_opening_id IS NOT NULL THEN
    UPDATE public.job_openings
    SET hired_association_id = NULL, filled_at = NULL, updated_at = now(), sourcer_user_id = NULL, recruiter_user_id = NULL
    WHERE id = v_opening_id AND hired_association_id = p_application_id;
  END IF;
  UPDATE public.job_candidate_associations
  SET status = 'offer', hired_at = NULL, hired_by = NULL, hire_start_date = NULL
  WHERE id = p_application_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_opening_event(_opening_id uuid, _event text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE o record; j record; _sal jsonb; _cand text; _status text; _payload jsonb;
BEGIN
  SELECT * INTO o FROM public.job_openings WHERE id = _opening_id;
  IF NOT FOUND OR o.sales_deal_id IS NULL THEN RETURN; END IF;
  SELECT * INTO j FROM public.jobs WHERE id = o.job_id;
  SELECT status, candidate_name INTO _status, _cand FROM public.job_openings_with_status WHERE id = _opening_id;
  IF _event IN ('opening.filled', 'opening.offer') THEN
    SELECT public.offer_base_salary(field_values) INTO _sal FROM public.offer_letters
     WHERE opening_id = _opening_id AND coalesce(status,'') NOT IN ('withdrawn','declined','expired','rejected','cancelled')
     ORDER BY (status = 'accepted') DESC, created_at DESC LIMIT 1;
  END IF;
  _payload := jsonb_build_object(
    'idempotency_key', 'opening_' || o.id || '_' || _event || '_' || floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    'event', _event, 'deal_id', o.sales_deal_id, 'line_id', o.sales_line_id, 'ats_job_id', j.id,
    'job_title', j.title, 'job_status', j.status::text,
    'opening', jsonb_strip_nulls(jsonb_build_object(
      'opening_id', o.id, 'req_id', o.req_id, 'status', _status,
      'target_hire_date', o.target_hire_date, 'target_start_date', o.target_start_date,
      'candidate_name', _cand,
      'base_salary', CASE WHEN _event IN ('opening.filled', 'opening.offer') THEN _sal->'amount' END,
      'currency', CASE WHEN _event IN ('opening.filled', 'opening.offer') THEN coalesce(_sal->>'currency', j.currency) END,
      'filled_at', CASE WHEN _event = 'opening.filled' THEN (o.filled_at)::date END,
      'cancel_reason', CASE WHEN _event = 'opening.cancelled' THEN o.cancel_reason END)),
    'hire_team', CASE WHEN _event = 'opening.filled' THEN jsonb_build_object(
      'sourcer', public.ats_person(o.sourcer_user_id), 'recruiter', public.ats_person(o.recruiter_user_id)) END);
  INSERT INTO public.integration_outbox(tenant_id, event, payload, idempotency_key)
  VALUES (o.tenant_id, _event, _payload, _payload->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING;
END $function$;

create or replace function public.job_assignments_sales_team_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare j record; v_payload jsonb;
begin
  if not ((tg_op <> 'DELETE' and new.role::text in ('sourcer', 'recruiter'))
       or (tg_op <> 'INSERT' and old.role::text in ('sourcer', 'recruiter'))) then
    return null;
  end if;
  select * into j from public.jobs where id = coalesce(new.job_id, old.job_id);
  if j.id is null or j.sales_deal_id is null then return null; end if;
  v_payload := jsonb_build_object(
    'idempotency_key', 'job_' || j.id || '_team_' || floor(extract(epoch from clock_timestamp())*1000)::bigint,
    'event', 'job.team_changed', 'deal_id', j.sales_deal_id, 'ats_job_id', j.id, 'job_title', j.title,
    'team', jsonb_build_object(
      'sourcers', coalesce((select jsonb_agg(public.ats_person(a.user_id)) from public.job_assignments a
                            where a.job_id = j.id and a.role = 'sourcer' and a.deleted_at is null), '[]'::jsonb),
      'recruiters', coalesce((select jsonb_agg(public.ats_person(a.user_id)) from public.job_assignments a
                              where a.job_id = j.id and a.role = 'recruiter' and a.deleted_at is null), '[]'::jsonb)));
  insert into public.integration_outbox(tenant_id, event, payload, idempotency_key)
  values (j.tenant_id, 'job.team_changed', v_payload, v_payload->>'idempotency_key')
  on conflict (idempotency_key) do nothing;
  return null;
end $$;
drop trigger if exists job_assignments_sales_team_event on public.job_assignments;
create trigger job_assignments_sales_team_event after insert or update or delete on public.job_assignments
  for each row execute function public.job_assignments_sales_team_event();