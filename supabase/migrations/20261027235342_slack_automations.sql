-- Slack: connect a workspace's Slack and send messages when things happen
-- (Allan, 2026-10-27).
--
-- One Slack connection per workspace (slack_connections). Its bot token is
-- encrypted with slack_token_key (Vault) and nobody reads the table: screens
-- ask slack_status, the Edge Functions use slack_connection_token (service
-- role only).
--
-- An automation (slack_automations) is "when X, send Y to Z": an event, an
-- optional filter (jobs, departments, clients, stages), where it goes
-- (channels, Slack people, or the job's Recruiter / Sourcer / Hiring manager /
-- interviewer by DM) and a message with {details} and Slack @tags. It is for
-- the whole workspace (job_id null: admins) or one job (admins and the job's
-- Recruiter, can_manage_job). Offer events are admins' only, since a channel
-- can hold anyone. Removing one sets removed_at (Undo restores it).
--
-- The database notices the events itself (triggers on applications, stage
-- moves, hires, rejections, interviews, scorecards, offer approvals, offer
-- signing and job status) and queues one slack_deliveries row per matching
-- automation (never twice for the same event). Each insert pokes the
-- slack-deliver Edge Function, which writes and posts the message; a
-- one-minute schedule retries what failed. Messages are written on the
-- server from ids, so no pay or salary ever reaches Slack.
--
-- Errors: GSL01 not allowed · GSL02 offer events are admins' only ·
-- GSL03 Slack isn't connected · GSL04 something in the automation is invalid.

-- 1. The key, generated here and kept in Vault (never written to the repo).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'slack_token_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'slack_token_key',
      'Encrypts Slack bot tokens in slack_connections (Gio ATS).');
  end if;
end $$;

create or replace function public.slack_token_key()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'slack_token_key' limit 1;
$function$;
revoke all on function public.slack_token_key() from public, anon, authenticated;

-- 2. Who.
create or replace function public.slack_is_admin(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(public.get_user_type_secure() = 'platform_admin', false)
    or exists (
      select 1 from public.members m
      where m.tenant_id = _tenant
        and m.user_id = auth.uid()
        and m.user_status = 'active'
        and (m.user_type in ('workspace_owner', 'platform_admin') or m.system_role = 'admin'));
$function$;
revoke all on function public.slack_is_admin(uuid) from public, anon;
grant execute on function public.slack_is_admin(uuid) to authenticated;

create or replace function public.slack_is_member(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(public.get_user_type_secure() = 'platform_admin', false)
    or exists (
      select 1 from public.members m
      where m.tenant_id = _tenant and m.user_id = auth.uid() and m.user_status = 'active');
$function$;
revoke all on function public.slack_is_member(uuid) from public, anon;
grant execute on function public.slack_is_member(uuid) to authenticated;

-- 3. Tables.
create table public.slack_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  team_id text not null,
  team_name text not null,
  team_domain text,
  team_icon text,
  bot_user_id text not null,
  app_id text,
  scopes text[] not null default '{}',
  token_enc text not null,
  status text not null default 'active' check (status in ('active', 'broken')),
  status_detail text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id)
);
create unique index slack_connections_one_live on public.slack_connections (tenant_id) where removed_at is null;
alter table public.slack_connections enable row level security;
-- No policies: nobody reads or writes it directly.

create table public.slack_automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  job_id uuid references public.jobs(id),
  name text check (name is null or char_length(name) <= 120),
  event text not null check (event in (
    'candidate.applied', 'candidate.stage_changed', 'candidate.hired', 'candidate.rejected',
    'interview.scheduled', 'interview.cancelled', 'scorecard.submitted',
    'offer.approval_requested', 'offer.approved', 'offer.sent', 'offer.signed', 'offer.declined',
    'job.opened', 'job.closed')),
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  destinations jsonb not null check (jsonb_typeof(destinations) = 'array'
    and jsonb_array_length(destinations) between 1 and 10),
  message text not null check (char_length(message) between 1 and 3000),
  is_active boolean not null default true,
  preset text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references auth.users(id),
  last_sent_at timestamptz,
  last_error text,
  last_error_at timestamptz
);
create index slack_automations_match on public.slack_automations (tenant_id, event) where removed_at is null and is_active;
create index slack_automations_job on public.slack_automations (job_id) where removed_at is null;
alter table public.slack_automations enable row level security;

-- Admins read every automation; anyone in the workspace reads the
-- workspace-wide ones (a job's Slack section lists them as "From workspace");
-- a job's own automations are read by those who manage that job.
create policy slack_automations_read on public.slack_automations
  for select to authenticated
  using (
    removed_at is null
    and (
      public.slack_is_admin(tenant_id)
      or (job_id is null and public.slack_is_member(tenant_id))
      or (job_id is not null and public.can_manage_job(job_id))));
-- Writes only through the functions below.

create table public.slack_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  automation_id uuid not null references public.slack_automations(id),
  event text not null,
  event_key text not null,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  error text,
  results jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (automation_id, event_key)
);
create index slack_deliveries_due on public.slack_deliveries (next_attempt_at) where status in ('queued', 'sending');
alter table public.slack_deliveries enable row level security;
-- No policies: the queue is the server's.

-- 4. Matching an event to automations and queueing it.
create or replace function public.slack_filter_ok(_filters jsonb, _key text, _value uuid)
returns boolean
language sql
immutable
as $function$
  select case
    when coalesce(jsonb_typeof(_filters -> _key), '') <> 'array' then true
    when jsonb_array_length(_filters -> _key) = 0 then true
    when _value is null then false
    else (_filters -> _key) ? _value::text
  end;
$function$;

create or replace function public.slack_emit(_tenant uuid, _event text, _key text, _ctx jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  j record;
  stage_lib uuid;
begin
  if _tenant is null then return; end if;
  if not exists (
    select 1 from public.slack_connections c
    where c.tenant_id = _tenant and c.removed_at is null and c.status = 'active'
  ) then
    return;
  end if;
  select id, department_id, organization_id into j
  from public.jobs where id = nullif(_ctx ->> 'job_id', '')::uuid;
  if nullif(_ctx ->> 'stage_id', '') is not null then
    select h.stage_id into stage_lib from public.job_hiring_stages h where h.id = (_ctx ->> 'stage_id')::uuid;
  end if;

  insert into public.slack_deliveries (tenant_id, automation_id, event, event_key, context)
  select _tenant, a.id, _event, _key, _ctx
  from public.slack_automations a
  where a.tenant_id = _tenant
    and a.event = _event
    and a.is_active
    and a.removed_at is null
    and (a.job_id is null or a.job_id = j.id)
    and public.slack_filter_ok(a.filters, 'job_ids', j.id)
    and public.slack_filter_ok(a.filters, 'department_ids', j.department_id)
    and public.slack_filter_ok(a.filters, 'client_ids', j.organization_id)
    and public.slack_filter_ok(a.filters, 'stage_ids', stage_lib)
  on conflict (automation_id, event_key) do nothing;
exception when others then
  -- Slack never stands in the way of the change that caused the event.
  raise warning 'slack_emit %: %', _event, sqlerrm;
end;
$function$;
revoke all on function public.slack_emit(uuid, text, text, jsonb) from public, anon, authenticated;

-- 5. The events.
create or replace function public.jca_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t uuid;
  base jsonb;
begin
  select tenant_id into t from public.jobs where id = new.job_id;
  if t is null then return null; end if;
  base := jsonb_build_object('association_id', new.id, 'candidate_id', new.candidate_id, 'job_id', new.job_id);

  if new.applied_at is not null and (tg_op = 'INSERT' or old.applied_at is null) then
    perform public.slack_emit(t, 'candidate.applied', 'applied:' || new.id,
      base || jsonb_build_object('stage_id', new.current_stage_id));
  end if;

  if tg_op = 'UPDATE' and new.current_stage_id is distinct from old.current_stage_id
     and new.current_stage_id is not null and new.status = 'active' then
    perform public.slack_emit(t, 'candidate.stage_changed',
      'stage:' || new.id || ':' || new.current_stage_id || ':' || coalesce(new.entered_stage_at, now())::text,
      base || jsonb_build_object('stage_id', new.current_stage_id, 'from_stage_id', old.current_stage_id,
        'actor_id', auth.uid()));
  end if;

  if tg_op = 'UPDATE' and new.status = 'hired' and old.status is distinct from 'hired' then
    perform public.slack_emit(t, 'candidate.hired', 'hired:' || new.id || ':' || coalesce(new.hired_at, now())::text,
      base || jsonb_build_object('stage_id', new.current_stage_id, 'opening_id', new.opening_id,
        'actor_id', coalesce(new.hired_by, auth.uid())));
  end if;

  if tg_op = 'UPDATE' and new.status = 'rejected' and old.status is distinct from 'rejected' then
    perform public.slack_emit(t, 'candidate.rejected', 'rejected:' || new.id || ':' || coalesce(new.rejected_at, now())::text,
      base || jsonb_build_object('stage_id', new.current_stage_id, 'reason_id', new.rejection_reason_id,
        'actor_id', coalesce(new.rejected_by, auth.uid()), 'by_gio', new.auto_rejected_rule is not null));
  end if;
  return null;
end;
$function$;
create trigger jca_z_slack after insert or update on public.job_candidate_associations
  for each row execute function public.jca_z_slack();

create or replace function public.scheduled_bookings_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t uuid;
  base jsonb;
begin
  if new.candidate_id is null or new.job_id is null then return null; end if;
  select tenant_id into t from public.jobs where id = new.job_id;
  base := jsonb_build_object('booking_id', new.id, 'candidate_id', new.candidate_id, 'job_id', new.job_id,
    'stage_id', new.job_hiring_stage_id, 'association_id', new.job_candidate_association_id);
  if tg_op = 'INSERT' and coalesce(new.status, '') <> 'cancelled' then
    perform public.slack_emit(t, 'interview.scheduled', 'interview:' || new.id,
      base || jsonb_build_object('actor_id', coalesce(new.booked_by, auth.uid())));
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.slack_emit(t, 'interview.cancelled', 'interview_cancelled:' || new.id,
      base || jsonb_build_object('actor_id', coalesce(new.cancelled_by, auth.uid())));
  end if;
  return null;
end;
$function$;
create trigger scheduled_bookings_z_slack after insert or update on public.scheduled_bookings
  for each row execute function public.scheduled_bookings_z_slack();

create or replace function public.job_stage_scorecards_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t uuid;
begin
  if new.rating is null or coalesce(new.is_ai_draft, false) then return null; end if;
  if tg_op = 'UPDATE' and old.rating is not null and not coalesce(old.is_ai_draft, false) then return null; end if;
  select tenant_id into t from public.jobs where id = new.job_id;
  perform public.slack_emit(t, 'scorecard.submitted', 'scorecard:' || new.id,
    jsonb_build_object('scorecard_id', new.id, 'candidate_id', new.candidate_id, 'job_id', new.job_id,
      'association_id', new.association_id, 'actor_id', coalesce(new.created_by, auth.uid()),
      'stage_id', (select a.current_stage_id from public.job_candidate_associations a where a.id = new.association_id)));
  return null;
end;
$function$;
create trigger job_stage_scorecards_z_slack after insert or update on public.job_stage_scorecards
  for each row execute function public.job_stage_scorecards_z_slack();

create or replace function public.offer_approval_requests_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  t uuid;
  base jsonb;
begin
  select tenant_id into t from public.jobs where id = new.job_id;
  base := jsonb_build_object('request_id', new.id, 'offer_id', new.offer_letter_id,
    'candidate_id', new.candidate_id, 'job_id', new.job_id);
  if tg_op = 'INSERT' then
    perform public.slack_emit(t, 'offer.approval_requested', 'approval_requested:' || new.id,
      base || jsonb_build_object('actor_id', coalesce(new.requested_by, auth.uid())));
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.slack_emit(t, 'offer.approved', 'approved:' || new.id,
      base || jsonb_build_object('actor_id', auth.uid()));
  end if;
  return null;
end;
$function$;
create trigger offer_approval_requests_z_slack after insert or update on public.offer_approval_requests
  for each row execute function public.offer_approval_requests_z_slack();

create or replace function public.sign_envelopes_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  base jsonb;
begin
  if new.offer_id is null then return null; end if;
  base := jsonb_build_object('envelope_id', new.id, 'offer_id', new.offer_id,
    'candidate_id', new.ats_candidate_id, 'job_id', new.ats_job_id);
  if new.sent_at is not null and (tg_op = 'INSERT' or old.sent_at is null) then
    perform public.slack_emit(new.tenant_id, 'offer.sent', 'offer_sent:' || new.id,
      base || jsonb_build_object('actor_id', coalesce(new.sender_user_id, auth.uid())));
  end if;
  if tg_op = 'UPDATE' and new.completed_at is not null and old.completed_at is null then
    perform public.slack_emit(new.tenant_id, 'offer.signed', 'offer_signed:' || new.id, base);
  end if;
  if tg_op = 'UPDATE' and new.declined_at is not null and old.declined_at is null then
    perform public.slack_emit(new.tenant_id, 'offer.declined', 'offer_declined:' || new.id, base);
  end if;
  return null;
end;
$function$;
create trigger sign_envelopes_z_slack after insert or update on public.sign_envelopes
  for each row execute function public.sign_envelopes_z_slack();

create or replace function public.jobs_z_slack()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.status is not distinct from old.status then return null; end if;
  if new.status = 'open' then
    perform public.slack_emit(new.tenant_id, 'job.opened', 'job_opened:' || new.id || ':' || now()::text,
      jsonb_build_object('job_id', new.id, 'actor_id', auth.uid()));
  elsif new.status in ('closed', 'archived') and old.status = 'open' then
    perform public.slack_emit(new.tenant_id, 'job.closed', 'job_closed:' || new.id || ':' || now()::text,
      jsonb_build_object('job_id', new.id, 'actor_id', auth.uid()));
  end if;
  return null;
end;
$function$;
create trigger jobs_z_slack after update of status on public.jobs
  for each row execute function public.jobs_z_slack();

-- 6. Delivering: one poke per statement that queued something, plus a
-- one-minute schedule for retries.
create or replace function public.slack_deliveries_z_kick()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/slack-deliver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := '{"kick": true}'::jsonb);
  return null;
exception when others then
  raise warning 'slack kick: %', sqlerrm;
  return null;
end;
$function$;
create trigger slack_deliveries_z_kick after insert on public.slack_deliveries
  for each statement execute function public.slack_deliveries_z_kick();

select cron.schedule(
  'slack-deliver',
  '* * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/slack-deliver',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')),
    body := '{"retry": true}'::jsonb)
  where exists (
    select 1 from public.slack_deliveries d
    where (d.status = 'queued' and d.next_attempt_at <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes'))
  $cmd$
);

-- 7. What a message is written from (server only): names, never pay.
create or replace function public.slack_person(_user uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', p.user_id,
    'name', coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Someone'),
    'email', coalesce(p.email, u.email))
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = _user;
$function$;
revoke all on function public.slack_person(uuid) from public, anon, authenticated;

create or replace function public.slack_message_context(_ctx jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  res jsonb := '{}'::jsonb;
  _job uuid := nullif(_ctx ->> 'job_id', '')::uuid;
  assoc uuid := nullif(_ctx ->> 'association_id', '')::uuid;
  opening record;
begin
  res := res || jsonb_build_object('candidate', (
    select jsonb_build_object('id', c.id, 'name', coalesce(nullif(trim(c.candidate_name), ''), 'Unnamed candidate'))
    from public.candidates c where c.id = nullif(_ctx ->> 'candidate_id', '')::uuid));
  res := res || jsonb_build_object('job', (
    select jsonb_build_object('id', j.id, 'title', j.title, 'client', o.name, 'department', d.name)
    from public.jobs j
    left join public.organizations o on o.id = j.organization_id
    left join public.departments d on d.id = j.department_id
    where j.id = _job));
  res := res || jsonb_build_object('stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'stage_id', '')::uuid));
  res := res || jsonb_build_object('from_stage', (
    select coalesce(nullif(h.custom_stage_name, ''), s.stage_name)
    from public.job_hiring_stages h left join public.job_stages s on s.id = h.stage_id
    where h.id = nullif(_ctx ->> 'from_stage_id', '')::uuid));
  res := res || jsonb_build_object('actor',
    case when coalesce((_ctx ->> 'by_gio')::boolean, false) then null
         else public.slack_person(nullif(_ctx ->> 'actor_id', '')::uuid) end);
  res := res || jsonb_build_object('reason', (
    select r.name from public.rejection_reasons r where r.id = nullif(_ctx ->> 'reason_id', '')::uuid));

  -- The job's people; a hire names who it credits.
  select o.req_id, o.sourcer_user_id, o.recruiter_user_id into opening
  from public.job_openings o
  where (assoc is not null and o.hired_association_id = assoc)
     or o.id = nullif(_ctx ->> 'opening_id', '')::uuid
  limit 1;
  res := res || jsonb_build_object(
    'opening', opening.req_id,
    'recruiters', coalesce(
      case when opening.recruiter_user_id is not null then jsonb_build_array(public.slack_person(opening.recruiter_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'recruiter' and a.deleted_at is null), '[]'::jsonb),
    'sourcers', coalesce(
      case when opening.sourcer_user_id is not null then jsonb_build_array(public.slack_person(opening.sourcer_user_id)) end,
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'sourcer' and a.deleted_at is null), '[]'::jsonb),
    'hiring_managers', coalesce(
      (select jsonb_agg(public.slack_person(a.user_id)) from public.job_assignments a
        where a.job_id = _job and a.role = 'hiring_manager' and a.deleted_at is null), '[]'::jsonb));

  if nullif(_ctx ->> 'booking_id', '') is not null then
    res := res || (
      select jsonb_build_object(
        'interviewer', public.slack_person(b.interviewer_id),
        'interview_start', b.scheduled_start,
        'interview_title', b.event_title)
      from public.scheduled_bookings b where b.id = (_ctx ->> 'booking_id')::uuid);
  end if;
  if nullif(_ctx ->> 'scorecard_id', '') is not null then
    res := res || (
      select jsonb_build_object('rating', s.rating::text)
      from public.job_stage_scorecards s where s.id = (_ctx ->> 'scorecard_id')::uuid);
  end if;
  return res;
end;
$function$;
revoke all on function public.slack_message_context(jsonb) from public, anon, authenticated;

-- 8. The worker's side (service role only).
create or replace function public.slack_deliveries_claim(_limit int default 25)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  claimed_rows jsonb;
begin
  -- Nothing waits when Slack is gone: skip what can't be sent.
  update public.slack_deliveries d set status = 'skipped', error = 'Slack isn''t connected'
  where d.status in ('queued', 'sending')
    and not exists (select 1 from public.slack_connections c
      where c.tenant_id = d.tenant_id and c.removed_at is null and c.status = 'active');

  with picked as (
    select d.id from public.slack_deliveries d
    where (d.status = 'queued' and d.next_attempt_at <= now())
       or (d.status = 'sending' and d.claimed_at < now() - interval '5 minutes')
    order by d.created_at
    limit greatest(1, least(_limit, 100))
    for update skip locked
  ), claimed as (
    update public.slack_deliveries d
    set status = 'sending', attempts = d.attempts + 1, claimed_at = now()
    from picked where d.id = picked.id
    returning d.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'tenant_id', c.tenant_id,
    'attempts', c.attempts,
    'event', c.event,
    'context', public.slack_message_context(c.context),
    'automation', jsonb_build_object('id', a.id, 'message', a.message, 'destinations', a.destinations, 'job_id', a.job_id),
    'connection', jsonb_build_object(
      'token', extensions.pgp_sym_decrypt(decode(k.token_enc, 'base64'), public.slack_token_key()),
      'team_id', k.team_id, 'bot_user_id', k.bot_user_id))), '[]'::jsonb)
  into claimed_rows
  from claimed c
  join public.slack_automations a on a.id = c.automation_id
  join public.slack_connections k on k.tenant_id = c.tenant_id and k.removed_at is null;
  return claimed_rows;
end;
$function$;
revoke all on function public.slack_deliveries_claim(int) from public, anon, authenticated;

create or replace function public.slack_delivery_finish(_id uuid, _ok boolean, _error text default null,
  _results jsonb default null, _retry boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d public.slack_deliveries;
begin
  select * into d from public.slack_deliveries where id = _id for update;
  if not found then return; end if;
  if _ok then
    update public.slack_deliveries set status = 'sent', sent_at = now(), error = _error, results = _results where id = _id;
    update public.slack_automations set last_sent_at = now(),
      last_error = case when _error is null then null else left(_error, 300) end,
      last_error_at = case when _error is null then null else now() end
    where id = d.automation_id;
  elsif _retry and d.attempts < 5 then
    update public.slack_deliveries set status = 'queued', error = left(_error, 500), results = _results,
      next_attempt_at = now() + make_interval(mins => (2 ^ d.attempts)::int)
    where id = _id;
  else
    update public.slack_deliveries set status = 'failed', error = left(_error, 500), results = _results where id = _id;
    update public.slack_automations set last_error = left(coalesce(_error, 'Couldn''t send'), 300), last_error_at = now()
    where id = d.automation_id;
  end if;
end;
$function$;
revoke all on function public.slack_delivery_finish(uuid, boolean, text, jsonb, boolean) from public, anon, authenticated;

-- Slack said the token no longer works (revoked, app removed).
create or replace function public.slack_connection_broken(_tenant uuid, _detail text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.slack_connections set status = 'broken', status_detail = left(_detail, 200)
  where tenant_id = _tenant and removed_at is null;
$function$;
revoke all on function public.slack_connection_broken(uuid, text) from public, anon, authenticated;

-- 9. Connecting (service role, after slack-oauth has checked the person).
create or replace function public.slack_connection_save(_tenant uuid, _user uuid, _team jsonb, _token text)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  k text := public.slack_token_key();
  new_id uuid;
begin
  if k is null then
    raise exception 'The Slack token key is missing from Vault.' using errcode = 'GSL04';
  end if;
  if coalesce(_token, '') = '' or coalesce(_team ->> 'team_id', '') = '' or coalesce(_team ->> 'bot_user_id', '') = '' then
    raise exception 'Slack didn''t send what Gio needs.' using errcode = 'GSL04';
  end if;
  update public.slack_connections set removed_at = now(), removed_by = _user
  where tenant_id = _tenant and removed_at is null;
  insert into public.slack_connections (tenant_id, team_id, team_name, team_domain, team_icon, bot_user_id, app_id,
    scopes, token_enc, connected_by)
  values (_tenant, _team ->> 'team_id', coalesce(nullif(_team ->> 'team_name', ''), 'Slack'),
    _team ->> 'team_domain', _team ->> 'team_icon', _team ->> 'bot_user_id', _team ->> 'app_id',
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(_team -> 'scopes', '[]'::jsonb)) x), '{}'),
    encode(pgp_sym_encrypt(_token, k), 'base64'), _user)
  returning id into new_id;
  -- Anything that waited while Slack was away is old news now.
  update public.slack_deliveries set status = 'skipped', error = 'Slack was reconnected'
  where tenant_id = _tenant and status in ('queued', 'sending');
  return new_id;
end;
$function$;
revoke all on function public.slack_connection_save(uuid, uuid, jsonb, text) from public, anon, authenticated;

create or replace function public.slack_connection_token(_tenant uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  select jsonb_build_object(
    'token', pgp_sym_decrypt(decode(c.token_enc, 'base64'), public.slack_token_key()),
    'team_id', c.team_id, 'bot_user_id', c.bot_user_id, 'status', c.status)
  from public.slack_connections c
  where c.tenant_id = _tenant and c.removed_at is null;
$function$;
revoke all on function public.slack_connection_token(uuid) from public, anon, authenticated;

create or replace function public.slack_connection_remove(_tenant uuid, _user uuid)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.slack_connections set removed_at = now(), removed_by = _user
  where tenant_id = _tenant and removed_at is null;
$function$;
revoke all on function public.slack_connection_remove(uuid, uuid) from public, anon, authenticated;

-- 10. What screens read and do.
create or replace function public.slack_status(_tenant uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  c public.slack_connections;
  r jsonb;
begin
  if not public.slack_is_member(_tenant) then
    raise exception 'You can''t see this workspace''s Slack.' using errcode = 'GSL01';
  end if;
  select * into c from public.slack_connections where tenant_id = _tenant and removed_at is null;
  r := jsonb_build_object(
    'connected', c.id is not null,
    'is_admin', public.slack_is_admin(_tenant),
    'can_edit_jobs', public.slack_is_admin(_tenant) or exists (
      select 1 from public.job_assignments a join public.jobs j on j.id = a.job_id
      where a.user_id = auth.uid() and a.role = 'recruiter' and a.deleted_at is null
        and j.tenant_id = _tenant and j.deleted_at is null),
    'automations', (select count(*) from public.slack_automations a
      where a.tenant_id = _tenant and a.removed_at is null and a.is_active));
  if c.id is not null then
    r := r || jsonb_build_object(
      'status', c.status,
      'status_detail', c.status_detail,
      'team_id', c.team_id,
      'team_name', c.team_name,
      'team_domain', c.team_domain,
      'team_icon', c.team_icon,
      'bot_user_id', c.bot_user_id,
      'connected_at', c.connected_at,
      'connected_by', public.slack_person(c.connected_by) ->> 'name');
  end if;
  return r;
end;
$function$;
revoke all on function public.slack_status(uuid) from public, anon;
grant execute on function public.slack_status(uuid) to authenticated;

-- May the caller add or change an automation for this workspace (job null)
-- or job, for this event? Raises with the reason; returns true otherwise.
create or replace function public.slack_check_edit(_tenant uuid, _job uuid, _event text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if _job is null then
    if not public.slack_is_admin(_tenant) then
      raise exception 'Only admins set up workspace-wide Slack automations.' using errcode = 'GSL01';
    end if;
  else
    if not exists (select 1 from public.jobs j where j.id = _job and j.tenant_id = _tenant and j.deleted_at is null) then
      raise exception 'That job isn''t in this workspace.' using errcode = 'GSL04';
    end if;
    if not public.can_manage_job(_job) then
      raise exception 'Only admins and the job''s Recruiter set up its Slack automations.' using errcode = 'GSL01';
    end if;
  end if;
  if _event like 'offer.%' and not public.slack_is_admin(_tenant) then
    raise exception 'Only admins send offer events to Slack.' using errcode = 'GSL02';
  end if;
  if not exists (select 1 from public.slack_connections c where c.tenant_id = _tenant and c.removed_at is null) then
    raise exception 'Connect Slack first.' using errcode = 'GSL03';
  end if;
  return true;
end;
$function$;
revoke all on function public.slack_check_edit(uuid, uuid, text) from public, anon;
grant execute on function public.slack_check_edit(uuid, uuid, text) to authenticated;

create or replace function public.slack_check_destinations(_d jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(_d) = 'array'
    and jsonb_array_length(_d) between 1 and 10
    and not exists (
      select 1 from jsonb_array_elements(_d) x
      where not (
        (x ->> 'type' in ('channel', 'user') and coalesce(x ->> 'id', '') ~ '^[CGDUW][A-Z0-9]{4,20}$'
          and char_length(coalesce(x ->> 'name', '')) <= 120)
        or (x ->> 'type' = 'role' and x ->> 'role' in ('recruiter', 'sourcer', 'hiring_manager', 'interviewer'))));
$function$;

create or replace function public.slack_check_filters(_f jsonb)
returns boolean
language sql
immutable
as $function$
  select jsonb_typeof(_f) = 'object'
    and not exists (select 1 from jsonb_object_keys(_f) k
      where k not in ('job_ids', 'department_ids', 'client_ids', 'stage_ids'))
    and not exists (
      select 1 from jsonb_each(_f) e
      where jsonb_typeof(e.value) <> 'array'
         or jsonb_array_length(e.value) > 200
         or exists (select 1 from jsonb_array_elements_text(e.value) v
           where v !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'));
$function$;

create or replace function public.slack_save_automation(
  _id uuid, _tenant uuid, _job uuid, _name text, _event text, _filters jsonb,
  _destinations jsonb, _message text, _is_active boolean default true, _preset text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cur public.slack_automations;
  out_id uuid;
begin
  if _id is not null then
    select * into cur from public.slack_automations where id = _id and removed_at is null;
    if not found then
      raise exception 'That automation is gone.' using errcode = 'GSL04';
    end if;
    -- The caller must be allowed on the automation as it is and as it will be.
    perform public.slack_check_edit(cur.tenant_id, cur.job_id, cur.event);
    if cur.tenant_id <> _tenant or cur.job_id is distinct from _job then
      raise exception 'An automation stays where it was made.' using errcode = 'GSL04';
    end if;
  end if;
  perform public.slack_check_edit(_tenant, _job, _event);
  if not public.slack_check_destinations(_destinations) then
    raise exception 'Pick between 1 and 10 places to send it.' using errcode = 'GSL04';
  end if;
  if not public.slack_check_filters(coalesce(_filters, '{}'::jsonb)) then
    raise exception 'The filter isn''t valid.' using errcode = 'GSL04';
  end if;
  if char_length(trim(coalesce(_message, ''))) = 0 or char_length(_message) > 3000 then
    raise exception 'Write a message (up to 3,000 characters).' using errcode = 'GSL04';
  end if;
  -- Offers: never pay. Details are names only; this catches a stray token.
  if _message ~* '\{\s*(salary|pay|compensation|amount|bonus|equity)' then
    raise exception 'Slack messages can''t include pay.' using errcode = 'GSL04';
  end if;

  if _id is null then
    insert into public.slack_automations (tenant_id, job_id, name, event, filters, destinations, message, is_active,
      preset, created_by, updated_by)
    values (_tenant, _job, nullif(trim(coalesce(_name, '')), ''), _event, coalesce(_filters, '{}'::jsonb),
      _destinations, _message, coalesce(_is_active, true), _preset, auth.uid(), auth.uid())
    returning id into out_id;
  else
    update public.slack_automations
    set name = nullif(trim(coalesce(_name, '')), ''), event = _event, filters = coalesce(_filters, '{}'::jsonb),
        destinations = _destinations, message = _message, is_active = coalesce(_is_active, is_active),
        updated_by = auth.uid(), updated_at = now(), last_error = null, last_error_at = null
    where id = _id
    returning id into out_id;
  end if;
  return out_id;
end;
$function$;
revoke all on function public.slack_save_automation(uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean, text) from public, anon;
grant execute on function public.slack_save_automation(uuid, uuid, uuid, text, text, jsonb, jsonb, text, boolean, text) to authenticated;

create or replace function public.slack_set_automation(_id uuid, _active boolean default null, _removed boolean default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cur public.slack_automations;
begin
  select * into cur from public.slack_automations where id = _id;
  if not found then
    raise exception 'That automation is gone.' using errcode = 'GSL04';
  end if;
  -- Admins and the job's Recruiter; a removed one can still be restored (Undo).
  if cur.job_id is null and not public.slack_is_admin(cur.tenant_id) then
    raise exception 'Only admins change workspace-wide Slack automations.' using errcode = 'GSL01';
  end if;
  if cur.job_id is not null and not public.can_manage_job(cur.job_id) then
    raise exception 'Only admins and the job''s Recruiter change its Slack automations.' using errcode = 'GSL01';
  end if;
  if cur.event like 'offer.%' and not public.slack_is_admin(cur.tenant_id) then
    raise exception 'Only admins change offer automations.' using errcode = 'GSL02';
  end if;
  update public.slack_automations
  set is_active = coalesce(_active, is_active),
      removed_at = case when _removed is null then removed_at when _removed then now() else null end,
      removed_by = case when _removed is null then removed_by when _removed then auth.uid() else null end,
      updated_by = auth.uid(), updated_at = now()
  where id = _id;
end;
$function$;
revoke all on function public.slack_set_automation(uuid, boolean, boolean) from public, anon;
grant execute on function public.slack_set_automation(uuid, boolean, boolean) to authenticated;

-- The list a screen shows: a workspace's automations (job null) or the ones
-- that fire for a job (its own, then the workspace-wide ones that apply).
create or replace function public.slack_automations_list(_tenant uuid, _job uuid default null)
returns table (
  id uuid, job_id uuid, job_title text, name text, event text, filters jsonb, destinations jsonb,
  message text, is_active boolean, preset text, created_by_name text, updated_at timestamptz,
  last_sent_at timestamptz, last_error text, last_error_at timestamptz, can_edit boolean)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
#variable_conflict use_column
declare
  admin boolean := public.slack_is_admin(_tenant);
begin
  if not public.slack_is_member(_tenant) then
    raise exception 'You can''t see this workspace''s Slack.' using errcode = 'GSL01';
  end if;
  if _job is not null and not (admin or public.can_manage_job(_job)) then
    raise exception 'Only admins and the job''s Recruiter see its Slack automations.' using errcode = 'GSL01';
  end if;
  return query
  select a.id, a.job_id, j.title, a.name, a.event, a.filters, a.destinations, a.message, a.is_active, a.preset,
    public.slack_person(a.created_by) ->> 'name', a.updated_at, a.last_sent_at, a.last_error, a.last_error_at,
    case
      when a.event like 'offer.%' then admin
      when a.job_id is null then admin
      else admin or public.can_manage_job(a.job_id)
    end
  from public.slack_automations a
  left join public.jobs j on j.id = a.job_id
  where a.tenant_id = _tenant
    and a.removed_at is null
    and (
      (_job is null and (admin or (a.job_id is not null and public.can_manage_job(a.job_id))))
      or (_job is not null and (a.job_id = _job or (a.job_id is null
        and public.slack_filter_ok(a.filters, 'job_ids', _job)
        and public.slack_filter_ok(a.filters, 'department_ids', (select department_id from public.jobs where id = _job))
        and public.slack_filter_ok(a.filters, 'client_ids', (select organization_id from public.jobs where id = _job))))))
  order by (a.job_id is null), a.created_at;
end;
$function$;
revoke all on function public.slack_automations_list(uuid, uuid) from public, anon;
grant execute on function public.slack_automations_list(uuid, uuid) to authenticated;
