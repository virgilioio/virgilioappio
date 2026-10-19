-- The offer trail in the candidate's Activity feed, part 2 (Allan, 2026-10-19)
--
-- "Record all activity derived from the offer: creation, approval requests,
-- approvals, agreements sent, signed, mark as hired, into the activity feed
-- of each candidate in their in-job profile." The database writes every
-- entry, so nothing depends on the browser, and every entry carries the
-- job (metadata.job_id), which is what the in-job feed reads
-- (get_candidate_activities).
--
-- 1. One job label. Some writers put the job under metadata.jobId (offer
--    created/updated, approvals, Mark hired's "Hired · filled"), which the
--    in-job feed never matched; a BEFORE INSERT trigger copies it to job_id,
--    and the rows already written get it too.
-- 2. offer_trail_log() / offer_trail_name(): one way to write an entry.
-- 3. Offers: created, and updated with the fields that changed (one entry per
--    person per 15 minutes, and none right after their own "created").
-- 4. Approvals: sent for approval (with the approvers, skipped ones left
--    out), each approver's approval or decline (with their note), recalled,
--    and fully approved (once, when no step is pending or declined).
-- 5. Gio Sign, for agreements with a candidate and a job: sent (with who it
--    went to), opened (first time per signer), signed, declined (reason),
--    voided (reason), expired, reminded, and signed by everyone. A signer
--    outside the team is named in metadata.author_name (external_actor).
-- The browser stops logging offer and approval entries itself in the same
-- release, so nothing is written twice.

-- ---- 1. One job label -----------------------------------------------------------
create or replace function public.activities_a_job_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.metadata ? 'jobId' and not (new.metadata ? 'job_id') and coalesce(new.metadata->>'jobId', '') <> '' then
    new.metadata := new.metadata || jsonb_build_object('job_id', new.metadata->>'jobId');
  end if;
  return new;
end;
$$;
create trigger activities_a_job_id
  before insert on public.activities
  for each row execute function public.activities_a_job_id();

update public.activities
   set metadata = metadata || jsonb_build_object('job_id', metadata->>'jobId')
 where metadata ? 'jobId' and not (metadata ? 'job_id') and coalesce(metadata->>'jobId', '') <> '';

-- ---- 2. Writing an entry ---------------------------------------------------------
create or replace function public.offer_trail_name(_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), split_part(u.email, '@', 1))
  from auth.users u left join public.profiles p on p.user_id = u.id
  where u.id = _user;
$$;

create or replace function public.offer_trail_log(
  _type public.activity_type, _user uuid, _candidate uuid, _job uuid,
  _title text, _description text, _meta jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_ten uuid;
  v_job_title text;
begin
  if _candidate is null or _job is null then
    return;
  end if;
  select j.organization_id, j.tenant_id, j.title into v_org, v_ten, v_job_title from public.jobs j where j.id = _job;
  insert into public.activities (activity_type, title, description, entity_type, entity_id, user_id, organization_id, tenant_id, metadata)
  values (_type, _title, nullif(btrim(coalesce(_description, '')), ''), 'candidate', _candidate,
          coalesce(_user, '00000000-0000-0000-0000-000000000000'), v_org, v_ten,
          coalesce(_meta, '{}'::jsonb) || jsonb_build_object('job_id', _job, 'job_title', v_job_title,
                                                             'candidate_id', _candidate, 'source', 'offer_trail'));
end;
$$;
revoke all on function public.offer_trail_log(public.activity_type, uuid, uuid, uuid, text, text, jsonb),
  public.offer_trail_name(uuid) from public, anon, authenticated;

-- ---- 3. Offers ---------------------------------------------------------------------
create or replace function public.offer_letters_z_trail()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := coalesce(auth.uid(), new.created_by);
  v_changed text;
begin
  if tg_op = 'INSERT' then
    perform public.offer_trail_log('offer_created', v_me, new.candidate_id, new.job_id,
      'Offer created', null, jsonb_build_object('offer_id', new.id));
  elsif new.field_values is distinct from old.field_values then
    -- A burst of edits reads as one "Offer updated"; edits right after creating it are part of creating it.
    if not exists (
      select 1 from public.activities a
      where a.entity_id = new.candidate_id and a.activity_type in ('offer_created', 'offer_updated')
        and a.metadata->>'offer_id' = new.id::text
        and a.user_id = coalesce(v_me, '00000000-0000-0000-0000-000000000000')
        and a.created_at > now() - interval '15 minutes') then
      -- Which fields changed, by their labels on the offer form.
      select string_agg(coalesce(nullif(btrim(f.field_label), ''), k.key), ', ' order by coalesce(f.display_order, 9999), k.key)
        into v_changed
        from (select jsonb_object_keys(coalesce(new.field_values, '{}'::jsonb)) as key
              union
              select jsonb_object_keys(coalesce(old.field_values, '{}'::jsonb))) k
        left join public.offer_form_fields f on f.form_id = new.form_id and f.field_name = k.key
       where (new.field_values -> k.key) is distinct from (old.field_values -> k.key);
      perform public.offer_trail_log('offer_updated', v_me, new.candidate_id, new.job_id,
        'Offer updated', case when v_changed is null then null else 'Changed: ' || v_changed end,
        jsonb_build_object('offer_id', new.id));
    end if;
  end if;
  return null;
end;
$$;
create trigger offer_letters_z_trail
  after insert or update of field_values on public.offer_letters
  for each row execute function public.offer_letters_z_trail();

-- ---- 4. Approvals -----------------------------------------------------------------
-- Sent for approval: written when the steps arrive (the request is written first).
create or replace function public.offer_approval_trail_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q record;
  v_names text;
begin
  for q in
    select r.* from public.offer_approval_requests r
    where r.id in (select distinct s.request_id from new_steps s)
  loop
    if exists (select 1 from public.activities a
               where a.entity_id = q.candidate_id and a.activity_type = 'approval_requested'
                 and a.metadata->>'request_id' = q.id::text) then
      continue;
    end if;
    select string_agg(coalesce(public.offer_trail_name(st.approver_user_id), 'an approver'), ', ' order by st.step_order)
      into v_names
      from public.offer_approval_request_steps st
     where st.request_id = q.id and st.status <> 'skipped';
    perform public.offer_trail_log('approval_requested', q.requested_by, q.candidate_id, q.job_id,
      'Sent the offer for approval',
      case when v_names is null then null else 'Approvers: ' || v_names end,
      jsonb_build_object('offer_id', q.offer_letter_id, 'request_id', q.id));
  end loop;
  return null;
end;
$$;

-- Fully approved: once, when the request is approved and no step is pending or declined.
create or replace function public.offer_approval_trail_complete(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.offer_approval_requests;
  v_names text;
  v_count int;
  v_last uuid;
begin
  select * into q from public.offer_approval_requests where id = _request_id;
  if q.id is null or q.status <> 'approved' then
    return;
  end if;
  if exists (select 1 from public.offer_approval_request_steps st
             where st.request_id = q.id and st.status in ('pending', 'declined')) then
    return;
  end if;
  select count(*), string_agg(coalesce(public.offer_trail_name(st.approver_user_id), 'an approver'), ', ' order by st.step_order)
    into v_count, v_names
    from public.offer_approval_request_steps st
   where st.request_id = q.id and st.status = 'approved';
  if v_count = 0 then
    return;
  end if;
  if exists (select 1 from public.activities a
             where a.entity_id = q.candidate_id and a.activity_type = 'approval_completed'
               and a.metadata->>'request_id' = q.id::text) then
    return;
  end if;
  select st.approver_user_id into v_last
    from public.offer_approval_request_steps st
   where st.request_id = q.id and st.status = 'approved'
   order by st.decided_at desc nulls last, st.step_order desc
   limit 1;
  perform public.offer_trail_log('approval_completed', v_last, q.candidate_id, q.job_id,
    'Offer fully approved',
    'Approved by ' || v_names || '. Ready to send for signature.',
    jsonb_build_object('offer_id', q.offer_letter_id, 'request_id', q.id, 'approvers', v_count));
end;
$$;

create or replace function public.offer_approval_trail_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.offer_approval_requests;
  v_type public.activity_type;
begin
  select * into q from public.offer_approval_requests where id = new.request_id;
  if q.id is null then
    return null;
  end if;
  if new.status in ('approved', 'declined') then
    v_type := case new.status when 'approved' then 'approval_approved' else 'approval_declined' end;
    if not exists (select 1 from public.activities a
                   where a.entity_id = q.candidate_id and a.activity_type = v_type
                     and a.metadata->>'step_id' = new.id::text) then
      perform public.offer_trail_log(v_type, new.approver_user_id, q.candidate_id, q.job_id,
        case new.status when 'approved' then 'Approved the offer' else 'Declined the offer' end,
        new.notes,
        jsonb_build_object('offer_id', q.offer_letter_id, 'request_id', q.id, 'step_id', new.id, 'step_order', new.step_order));
    end if;
  end if;
  perform public.offer_approval_trail_complete(q.id);
  return null;
end;
$$;

create or replace function public.offer_approval_trail_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'recalled' then
    perform public.offer_trail_log('approval_recalled', coalesce(auth.uid(), new.requested_by), new.candidate_id, new.job_id,
      'Recalled the approval request', null,
      jsonb_build_object('offer_id', new.offer_letter_id, 'request_id', new.id));
  elsif new.status = 'approved' then
    perform public.offer_approval_trail_complete(new.id);
  end if;
  return null;
end;
$$;

revoke all on function public.offer_approval_trail_complete(uuid), public.offer_approval_trail_requested(),
  public.offer_approval_trail_step(), public.offer_approval_trail_request(), public.offer_letters_z_trail()
  from public, anon, authenticated;

create trigger offer_approval_steps_z_trail_insert
  after insert on public.offer_approval_request_steps
  referencing new table as new_steps
  for each statement execute function public.offer_approval_trail_requested();
create trigger offer_approval_steps_z_trail_update
  after update of status on public.offer_approval_request_steps
  for each row when (old.status is distinct from new.status)
  execute function public.offer_approval_trail_step();
create trigger offer_approval_requests_z_trail
  after update of status on public.offer_approval_requests
  for each row when (old.status is distinct from new.status)
  execute function public.offer_approval_trail_request();

-- ---- 5. Gio Sign ---------------------------------------------------------------------
create or replace function public.sign_events_z_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.sign_envelopes;
  r public.sign_recipients;
  v_doc text;
  v_who text;
  v_type public.activity_type;
  v_title text;
  v_desc text;
  v_actor uuid;
  v_meta jsonb;
begin
  if new.kind not in ('sent', 'opened', 'signed', 'declined', 'voided', 'expired', 'reminded', 'sealed') then
    return null;
  end if;
  select * into e from public.sign_envelopes where id = new.envelope_id;
  if e.id is null or e.ats_candidate_id is null or e.ats_job_id is null then
    return null;
  end if;
  if new.recipient_id is not null then
    select * into r from public.sign_recipients where id = new.recipient_id;
  end if;
  v_doc := '“' || coalesce(nullif(btrim(e.title), ''), 'the agreement') || '”';
  v_who := coalesce(nullif(btrim(r.name), ''), nullif(btrim(new.actor_name), ''), r.email, new.actor_email, 'A signer');
  v_actor := coalesce(new.actor_user_id, e.sender_user_id, e.created_by);
  v_meta := jsonb_build_object('envelope_id', e.id, 'offer_id', e.offer_id, 'recipient_id', new.recipient_id, 'sign_event_id', new.id);

  case new.kind
    when 'sent' then
      -- One entry per agreement, however many signers it went to.
      if exists (select 1 from public.activities a where a.entity_id = e.ats_candidate_id
                 and a.activity_type = 'agreement_sent' and a.metadata->>'envelope_id' = e.id::text) then
        return null;
      end if;
      v_type := 'agreement_sent';
      v_title := 'Sent ' || v_doc || ' for signature';
      select 'To: ' || string_agg(coalesce(nullif(btrim(x.name), ''), x.email), ', ' order by x.position)
        into v_desc
        from public.sign_recipients x
       where x.envelope_id = e.id and x.removed_at is null and x.role in ('signer', 'approver');
    when 'opened' then
      -- The first time each signer opens it.
      if exists (select 1 from public.activities a where a.entity_id = e.ats_candidate_id
                 and a.activity_type = 'agreement_opened' and a.metadata->>'envelope_id' = e.id::text
                 and a.metadata->>'recipient_id' is not distinct from new.recipient_id::text) then
        return null;
      end if;
      v_type := 'agreement_opened';
      v_title := v_who || ' opened ' || v_doc;
    when 'signed' then
      v_type := 'agreement_signed';
      v_title := v_who || ' signed ' || v_doc;
    when 'declined' then
      v_type := 'agreement_declined';
      v_title := v_who || ' declined to sign ' || v_doc;
      v_desc := coalesce(nullif(btrim(r.decline_reason), ''), new.detail->>'reason');
    when 'voided' then
      v_type := 'agreement_voided';
      v_title := 'Voided ' || v_doc;
      v_desc := coalesce(nullif(btrim(e.void_reason), ''), new.detail->>'reason');
    when 'expired' then
      v_type := 'agreement_expired';
      v_title := v_doc || ' expired before everyone signed';
    when 'reminded' then
      v_type := 'agreement_reminded';
      v_title := 'Reminder sent for ' || v_doc;
      v_desc := case when r.id is not null then 'To: ' || v_who end;
    when 'sealed' then
      if exists (select 1 from public.activities a where a.entity_id = e.ats_candidate_id
                 and a.activity_type = 'agreement_completed' and a.metadata->>'envelope_id' = e.id::text) then
        return null;
      end if;
      v_type := 'agreement_completed';
      v_title := v_doc || ' signed by everyone';
  end case;

  -- Someone outside the team (the candidate) did it: the feed names them, not the sender.
  if new.kind in ('opened', 'signed', 'declined') and new.actor_user_id is null then
    v_meta := v_meta || jsonb_build_object('author_name', v_who, 'external_actor', true);
  end if;

  perform public.offer_trail_log(v_type, v_actor, e.ats_candidate_id, e.ats_job_id, v_title, v_desc, v_meta);
  return null;
end;
$$;
revoke all on function public.sign_events_z_activity() from public, anon, authenticated;

create trigger sign_events_z_activity
  after insert on public.sign_events
  for each row execute function public.sign_events_z_activity();
