-- Changing a hire (Allan, 2026-10-23). Once a candidate is marked hired, only
-- admins (platform admins and the workspace's active admins) change the hire:
-- undo it (unmark_hired) or change who is credited (change_hire_credit). Until
-- now anyone on the job could undo a hire, and anyone on the job could edit a
-- filled opening's hire columns directly. Gio Sales now hears about both
-- (opening.unfilled, opening.credit_changed) and gets the credited Sourcer and
-- Recruiter with every change, as it already does on opening.filled.

-- 1. Who may change a hire.
create or replace function public.can_change_hire(_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_type_secure() = 'platform_admin'
    or exists (
      select 1
      from public.jobs j
      join public.members m on m.tenant_id = j.tenant_id
      where j.id = _job_id
        and m.user_id = auth.uid()
        and m.user_status = 'active'
        and m.system_role = 'admin'
    )
$$;

revoke execute on function public.can_change_hire(uuid) from public, anon;
grant execute on function public.can_change_hire(uuid) to authenticated, service_role;

-- 2. The hire columns change only through mark_hired, unmark_hired and
-- change_hire_credit. Direct writes from the app are refused. Database
-- functions (the owner), the service role and foreign-key actions pass.
create or replace function public.job_openings_hire_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon')
     or pg_trigger_depth() > 1
     or coalesce(current_setting('gio.hire_write', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.hired_association_id is not null or new.filled_at is not null
       or new.sourcer_user_id is not null or new.recruiter_user_id is not null then
      raise exception 'A new opening can''t start filled. Mark a candidate hired instead.' using errcode = 'GHC01';
    end if;
  elsif new.hired_association_id is distinct from old.hired_association_id
     or new.filled_at is distinct from old.filled_at
     or new.sourcer_user_id is distinct from old.sourcer_user_id
     or new.recruiter_user_id is distinct from old.recruiter_user_id then
    raise exception 'A hire changes only through Mark hired, Undo hire or Change credit.' using errcode = 'GHC01';
  end if;
  return new;
end
$$;

create trigger a1_job_openings_hire_guard
  before insert or update on public.job_openings
  for each row execute function public.job_openings_hire_guard();

-- 3. mark_hired: unchanged, except that it opens the guard for its own update.
create or replace function public.mark_hired(p_application_id uuid, p_opening_id uuid, p_start_date date, p_close_job boolean default false, p_sourcer_id uuid default null, p_recruiter_id uuid default null)
returns table(req_id text, openings_remaining integer, job_closed boolean)
language plpgsql
set search_path = public
as $function$
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

  PERFORM set_config('gio.hire_write', 'on', true);
  UPDATE public.job_openings
  SET hired_association_id = p_application_id, filled_at = now(), updated_at = now(),
      sourcer_user_id = v_sourcer, recruiter_user_id = v_recruiter
  WHERE id = p_opening_id;
  PERFORM set_config('gio.hire_write', 'off', true);

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

-- 4. Undo hire: admins only, and it now leaves a line in the candidate's activity.
create or replace function public.unmark_hired(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job_id uuid; v_org_id uuid; v_candidate_id uuid; v_opening_id uuid; v_req_id text;
begin
  if v_user_id is null then raise exception 'You must be signed in to update this hire.'; end if;
  select jca.job_id, j.organization_id, jca.candidate_id, jca.opening_id
    into v_job_id, v_org_id, v_candidate_id, v_opening_id
  from public.job_candidate_associations jca join public.jobs j on j.id = jca.job_id
  where jca.id = p_application_id for update of jca;
  if v_job_id is null then raise exception 'Candidate application not found.'; end if;
  if not public.can_change_hire(v_job_id) then
    raise exception 'Only an admin can undo a hire.' using errcode = '42501';
  end if;

  if v_opening_id is not null then
    update public.job_openings
    set hired_association_id = null, filled_at = null, updated_at = now(), sourcer_user_id = null, recruiter_user_id = null
    where id = v_opening_id and hired_association_id = p_application_id
    returning job_openings.req_id into v_req_id;
  end if;

  update public.job_candidate_associations
  set status = 'offer', hired_at = null, hired_by = null, hire_start_date = null
  where id = p_application_id;

  insert into public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id)
  values (v_user_id, v_org_id, 'candidate_status_changed',
          'Hire undone' || coalesce(' · ' || v_req_id || ' reopened', ''),
          'The hire was undone and the candidate is back at the offer stage.'
            || coalesce(' Opening ' || v_req_id || ' is open again.', ''),
          jsonb_build_object('candidateId', v_candidate_id, 'jobId', v_job_id, 'associationId', p_application_id,
                             'openingId', v_opening_id, 'reqId', v_req_id),
          'candidate', v_candidate_id);
end
$$;

revoke execute on function public.unmark_hired(uuid) from public, anon;
grant execute on function public.unmark_hired(uuid) to authenticated, service_role;

-- 5. Change credit: admins only. The new people must hold that seat on the job,
-- as in Mark hired. A change is written to the candidate's activity.
create or replace function public.change_hire_credit(p_opening_id uuid, p_sourcer_id uuid, p_recruiter_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  o record;
  v_parts text[] := '{}';
begin
  if v_user_id is null then raise exception 'You must be signed in to change this hire.'; end if;
  select jo.id, jo.job_id, jo.req_id, jo.hired_association_id, jo.sourcer_user_id, jo.recruiter_user_id,
         j.organization_id, jca.candidate_id
    into o
  from public.job_openings jo
  join public.jobs j on j.id = jo.job_id
  left join public.job_candidate_associations jca on jca.id = jo.hired_association_id
  where jo.id = p_opening_id
  for update of jo;
  if o.id is null then raise exception 'Opening not found.'; end if;
  if not public.can_change_hire(o.job_id) then
    raise exception 'Only an admin can change who is credited on a hire.' using errcode = '42501';
  end if;
  if o.hired_association_id is null then
    raise exception '% isn''t filled, so there''s no hire to change.', o.req_id;
  end if;
  if p_sourcer_id is null or p_recruiter_id is null then
    raise exception 'A hire credits one Sourcer and one Recruiter.';
  end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = o.job_id and a.user_id = p_sourcer_id
                 and a.role = 'sourcer' and a.deleted_at is null) then
    raise exception 'That person is not a Sourcer on this job.';
  end if;
  if not exists (select 1 from public.job_assignments a where a.job_id = o.job_id and a.user_id = p_recruiter_id
                 and a.role = 'recruiter' and a.deleted_at is null) then
    raise exception 'That person is not a Recruiter on this job.';
  end if;
  if p_sourcer_id is not distinct from o.sourcer_user_id and p_recruiter_id is not distinct from o.recruiter_user_id then
    return;
  end if;

  update public.job_openings
  set sourcer_user_id = p_sourcer_id, recruiter_user_id = p_recruiter_id, updated_at = now()
  where id = p_opening_id;

  if p_sourcer_id is distinct from o.sourcer_user_id then
    v_parts := v_parts || ('Sourcer: ' || coalesce(nullif(public.ats_person(o.sourcer_user_id)->>'name', ''), 'nobody')
                           || ' → ' || coalesce(nullif(public.ats_person(p_sourcer_id)->>'name', ''), 'someone') || '.');
  end if;
  if p_recruiter_id is distinct from o.recruiter_user_id then
    v_parts := v_parts || ('Recruiter: ' || coalesce(nullif(public.ats_person(o.recruiter_user_id)->>'name', ''), 'nobody')
                           || ' → ' || coalesce(nullif(public.ats_person(p_recruiter_id)->>'name', ''), 'someone') || '.');
  end if;

  insert into public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id)
  values (v_user_id, o.organization_id, 'candidate_status_changed', 'Hire credit changed · ' || o.req_id,
          array_to_string(v_parts, ' '),
          jsonb_build_object('candidateId', o.candidate_id, 'jobId', o.job_id, 'associationId', o.hired_association_id,
                             'openingId', o.id, 'reqId', o.req_id,
                             'sourcerId', p_sourcer_id, 'recruiterId', p_recruiter_id,
                             'previousSourcerId', o.sourcer_user_id, 'previousRecruiterId', o.recruiter_user_id),
          'candidate', o.candidate_id);
end
$$;

revoke execute on function public.change_hire_credit(uuid, uuid, uuid) from public, anon;
grant execute on function public.change_hire_credit(uuid, uuid, uuid) to authenticated, service_role;

-- 6. Tell Gio Sales when a hire is undone or its credit changes.
create or replace function public.job_openings_sales_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sales_deal_id is null then return null; end if;
  if old.cancelled_at is null and new.cancelled_at is not null then
    perform public.enqueue_opening_event(new.id, 'opening.cancelled');
  elsif old.hired_association_id is null and new.hired_association_id is not null then
    perform public.enqueue_opening_event(new.id, 'opening.filled');
  elsif old.hired_association_id is not null and new.hired_association_id is null then
    perform public.enqueue_opening_event(new.id, 'opening.unfilled');
  elsif new.hired_association_id is not null
        and (old.sourcer_user_id is distinct from new.sourcer_user_id
             or old.recruiter_user_id is distinct from new.recruiter_user_id) then
    perform public.enqueue_opening_event(new.id, 'opening.credit_changed');
  elsif old.target_hire_date is distinct from new.target_hire_date or old.target_start_date is distinct from new.target_start_date then
    perform public.enqueue_opening_event(new.id, 'opening.dates_changed');
  end if;
  return null;
end
$$;

-- 7. The credited people travel with opening.credit_changed as well as opening.filled.
create or replace function public.enqueue_opening_event(_opening_id uuid, _event text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
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
    'hire_team', CASE WHEN _event IN ('opening.filled', 'opening.credit_changed') THEN jsonb_build_object(
      'sourcer', public.ats_person(o.sourcer_user_id), 'recruiter', public.ats_person(o.recruiter_user_id)) END);
  INSERT INTO public.integration_outbox(tenant_id, event, payload, idempotency_key)
  VALUES (o.tenant_id, _event, _payload, _payload->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING;
END $function$;
