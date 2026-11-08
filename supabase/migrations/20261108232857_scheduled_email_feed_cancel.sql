-- Scheduled emails in the Activity feed, cancelling from the rejection banner (2026-11-08, Allan).
--
-- 1. Every scheduled email about a candidate gets one Activity line when it's scheduled
--    (the Reject dialog, bulk reject, Application review's "Later", Gio's automatic
--    rejections, scheduled bulk emails), and that line follows the email: scheduled,
--    sent, cancelled (by someone, or the candidate was restored) or couldn't be sent.
-- 2. scheduled_email_cancel / scheduled_email_uncancel: the banner's Cancel email and
--    its Undo, for the people who can reject candidates on that job.
-- 3. Restoring a candidate already cancels their waiting rejection email
--    (jca_z_restore_email); it now says why and who.

alter table public.scheduled_emails
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancel_reason text
    constraint scheduled_emails_cancel_reason_check check (cancel_reason in ('cancelled', 'restored'));

comment on column public.scheduled_emails.cancel_reason is
  'Why a cancelled email was cancelled: someone cancelled it, or the candidate was restored.';

-- ── The Activity line ────────────────────────────────────────────────────────────────
create or replace function public.scheduled_email_activity_title(p_type text, p_state text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_state
    when 'cancelled' then case when p_type = 'rejection' then 'Scheduled rejection email cancelled' else 'Scheduled email cancelled' end
    when 'failed'    then case when p_type = 'rejection' then 'Scheduled rejection email couldn''t be sent' else 'Scheduled email couldn''t be sent' end
    when 'sent'      then case when p_type = 'rejection' then 'Scheduled rejection email sent' else 'Scheduled email sent' end
    else                  case when p_type = 'rejection' then 'Rejection email scheduled' else 'Email scheduled' end
  end
$$;

-- Writes or updates the one line for this scheduled email.
create or replace function public.scheduled_email_activity_sync(se public.scheduled_emails)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _state text := case se.status when 'pending' then 'scheduled' else se.status end;
  _by_name text;
  _job_title text;
  _org uuid;
  _cand_name text;
  _meta jsonb;
begin
  if se.candidate_id is null then
    return;
  end if;

  if se.cancelled_by is not null then
    select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '')
      into _by_name
      from public.profiles p where p.user_id = se.cancelled_by;
  end if;

  _meta := jsonb_strip_nulls(jsonb_build_object(
    'state', _state,
    'scheduled_for', se.scheduled_for,
    'sent_at', se.sent_at,
    'cancelled_at', se.cancelled_at,
    'cancel_reason', se.cancel_reason,
    'cancelled_by', se.cancelled_by,
    'cancelled_by_name', _by_name
  ));

  update public.activities a
     set title = public.scheduled_email_activity_title(se.email_type, _state),
         metadata = (a.metadata - 'sent_at' - 'cancelled_at' - 'cancel_reason' - 'cancelled_by' - 'cancelled_by_name') || _meta
   where a.activity_type = 'candidate_email_scheduled'
     and a.entity_type = 'candidate'
     and a.entity_id = se.candidate_id
     and a.metadata->>'scheduled_email_id' = se.id::text;
  if found then
    return;
  end if;

  select j.title, j.organization_id into _job_title, _org from public.jobs j where j.id = se.job_id;
  select c.candidate_name into _cand_name from public.candidates c where c.id = se.candidate_id;

  insert into public.activities (activity_type, title, description, entity_type, entity_id, user_id,
                                 organization_id, tenant_id, metadata, created_at)
  values ('candidate_email_scheduled',
          public.scheduled_email_activity_title(se.email_type, _state),
          se.subject,
          'candidate', se.candidate_id,
          coalesce(se.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(se.organization_id, _org), se.tenant_id,
          jsonb_strip_nulls(jsonb_build_object(
            'source', 'scheduled_email',
            'scheduled_email_id', se.id,
            'email_type', se.email_type,
            'subject', se.subject,
            'to', to_jsonb(se.to_emails),
            'job_id', se.job_id,
            'job_title', _job_title,
            'candidate_id', se.candidate_id,
            'candidate_name', _cand_name,
            'association_id', se.association_id
          ))
          || case when se.created_by is null
               then jsonb_build_object('external_actor', 'gio', 'author_name', 'Gio')
               else '{}'::jsonb end
          || _meta,
          coalesce(se.created_at, now()));
end;
$$;

revoke all on function public.scheduled_email_activity_sync(public.scheduled_emails) from public, anon, authenticated;

create or replace function public.scheduled_emails_z_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.scheduled_for is not distinct from old.scheduled_for then
    return new;
  end if;
  perform public.scheduled_email_activity_sync(new);
  return new;
end;
$$;

create or replace trigger scheduled_emails_z_activity
  after insert or update on public.scheduled_emails
  for each row execute function public.scheduled_emails_z_activity();

-- ── Who may cancel: whoever may reject candidates on the job ─────────────────────────
-- The same rule as job_candidate_associations' update policy; an email with no job
-- follows scheduled_emails' own rule.
create or replace function public.scheduled_email_can_act(p_job_id uuid, p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_type_secure() = 'platform_admin'
      or (p_job_id is not null and (
            public.is_user_assigned_to_job(p_job_id)
            or public.user_has_org_hierarchy_access((select j.organization_id from public.jobs j where j.id = p_job_id))))
      or (p_job_id is null and exists (
            select 1 from public.members m
             where m.user_id = auth.uid() and m.tenant_id = p_tenant_id and m.user_status = 'active')
          and public.has_workspace_wide_access(p_tenant_id))
$$;

revoke all on function public.scheduled_email_can_act(uuid, uuid) from public, anon;
grant execute on function public.scheduled_email_can_act(uuid, uuid) to authenticated;

-- ── Cancel and its Undo ──────────────────────────────────────────────────────────────
create or replace function public.scheduled_email_cancel(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  se public.scheduled_emails;
begin
  if auth.uid() is null then
    raise exception 'Sign in to cancel an email.' using errcode = '28000';
  end if;
  select * into se from public.scheduled_emails where id = p_id for update;
  if not found or not public.scheduled_email_can_act(se.job_id, se.tenant_id) then
    raise exception 'Couldn''t find that email.' using errcode = 'GSE01';
  end if;
  if se.status <> 'pending' then
    raise exception 'This email isn''t waiting to go out any more.' using errcode = 'GSE02';
  end if;

  update public.scheduled_emails
     set status = 'cancelled', cancel_reason = 'cancelled', cancelled_at = now(),
         cancelled_by = auth.uid(), updated_at = now()
   where id = p_id;

  if se.email_type = 'rejection' and se.association_id is not null then
    update public.job_candidate_associations
       set rejection_email_scheduled_for = null
     where id = se.association_id and rejection_email_scheduled_for is not null;
  end if;
end;
$$;

create or replace function public.scheduled_email_uncancel(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  se public.scheduled_emails;
  _status text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;
  select * into se from public.scheduled_emails where id = p_id for update;
  if not found or not public.scheduled_email_can_act(se.job_id, se.tenant_id) then
    raise exception 'Couldn''t find that email.' using errcode = 'GSE01';
  end if;
  if se.status <> 'cancelled' or se.cancel_reason is distinct from 'cancelled' then
    raise exception 'This email can''t be brought back.' using errcode = 'GSE02';
  end if;
  if se.scheduled_for < now() + interval '1 minute' then
    raise exception 'Its send time has passed.' using errcode = 'GSE03';
  end if;
  if se.email_type = 'rejection' and se.association_id is not null then
    select lower(coalesce(status, '')) into _status from public.job_candidate_associations where id = se.association_id;
    if _status is distinct from 'rejected' then
      raise exception 'The candidate isn''t rejected any more.' using errcode = 'GSE04';
    end if;
  end if;

  update public.scheduled_emails
     set status = 'pending', cancel_reason = null, cancelled_at = null, cancelled_by = null, updated_at = now()
   where id = p_id;

  if se.email_type = 'rejection' and se.association_id is not null then
    update public.job_candidate_associations
       set rejection_email_scheduled_for = se.scheduled_for
     where id = se.association_id;
  end if;
  return se.scheduled_for;
end;
$$;

revoke all on function public.scheduled_email_cancel(uuid) from public, anon;
revoke all on function public.scheduled_email_uncancel(uuid) from public, anon;
grant execute on function public.scheduled_email_cancel(uuid) to authenticated;
grant execute on function public.scheduled_email_uncancel(uuid) to authenticated;

-- ── Restoring a candidate: cancel the waiting rejection email, saying why ────────────
create or replace function public.jca_z_restore_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if lower(coalesce(old.status, '')) = 'rejected' and lower(coalesce(new.status, '')) <> 'rejected' then
    update public.scheduled_emails
       set status = 'cancelled', cancel_reason = 'restored', cancelled_at = now(),
           cancelled_by = auth.uid(), updated_at = now()
     where association_id = new.id and email_type = 'rejection' and status = 'pending';
  end if;
  return new;
end;
$function$;

-- ── Emails already waiting get their line ────────────────────────────────────────────
select public.scheduled_email_activity_sync(s)
  from public.scheduled_emails s
 where s.status = 'pending';
