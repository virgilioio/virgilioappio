-- One-click offboarding (design "Gio OS: People & Access", Part D; Allan 2026-10-14).
--
-- Offboard on a person's page does, in order, and records each step:
--   1. ATS (os_offboard_ats, one transaction): removes their seats on job
--      teams, removes their Gio Sales and Gio Docs access (queued to those
--      apps like any other change), sets their ATS membership inactive and
--      marks them offboarded in People & Access.
--   2. Apps: the queued removals are sent (os-sync).
--   3. Sign-out: their ATS sign-in is blocked and their sessions end.
--   4. Google: their Google connection is revoked with Google and removed.
-- Steps 2-4 run in the os-offboard edge function. A step that fails stays on
-- the person's page as "Couldn't ... · Retry"; running Offboard again only
-- repeats what isn't done. Their past work stays, under their name.
--
-- The same rules as every other access change: admins only, never yourself,
-- only a platform admin offboards a platform admin, and the workspace keeps
-- at least one active admin. os_offboard_preview() shows what will change
-- first, so the admin can hand jobs to someone else.

create table public.os_offboardings (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id),
  user_id      uuid not null references auth.users(id),
  started_by   uuid not null references auth.users(id),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  steps        jsonb not null default '{}'::jsonb   -- { step: { status: 'done' | 'error', at, detail } }
);

create unique index os_offboardings_open on public.os_offboardings (tenant_id, user_id) where finished_at is null;

comment on table public.os_offboardings is
  'One row per offboarding: who, who started it, and each step''s result. Written by os_offboard_ats() and the os-offboard edge function.';

alter table public.os_offboardings enable row level security;

create policy os_offboardings_read on public.os_offboardings
  for select to authenticated
  using (public.is_os_admin(tenant_id));

-- Who may offboard whom.
create or replace function public.os_offboard_guard(_tenant_id uuid, _user_id uuid)
returns void language plpgsql stable security definer set search_path = 'public' as $$
declare target public.members%rowtype;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only admins can offboard people.' using errcode = '42501';
  end if;
  if _user_id = auth.uid() then
    raise exception 'You can''t offboard yourself. Ask another admin.' using errcode = 'GOS03';
  end if;
  select * into target from public.members
  where tenant_id = _tenant_id and user_id = _user_id
  order by (user_status = 'active') desc limit 1;
  if not found then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  if target.user_type = 'platform_admin' and public.get_user_type_secure() <> 'platform_admin' then
    raise exception 'Only a platform admin can offboard a platform admin.' using errcode = 'GOS03';
  end if;
  if target.system_role = 'admin' and target.user_status = 'active'
     and not exists (select 1 from public.members o
                     where o.tenant_id = _tenant_id and o.user_status = 'active'
                       and o.system_role = 'admin' and o.user_id <> _user_id) then
    raise exception 'The workspace needs at least one admin.' using errcode = 'GOS04';
  end if;
end $$;
revoke execute on function public.os_offboard_guard(uuid, uuid) from public, anon;
grant execute on function public.os_offboard_guard(uuid, uuid) to authenticated;

-- What offboarding will change, for the confirmation dialog.
create or replace function public.os_offboard_preview(_tenant_id uuid, _user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = 'public' as $$
begin
  perform public.os_offboard_guard(_tenant_id, _user_id);
  return jsonb_build_object(
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('job_id', j.id, 'title', j.title, 'status', j.status, 'role', ja.role)
                       order by j.title)
      from public.job_assignments ja
      join public.jobs j on j.id = ja.job_id
      where ja.user_id = _user_id and ja.deleted_at is null and j.tenant_id = _tenant_id
        and j.status in ('draft', 'open')), '[]'::jsonb),
    'apps', coalesce((
      select jsonb_agg(jsonb_build_object('app', g.app_key, 'role', g.role) order by g.app_key)
      from public.os_app_grants g
      where g.tenant_id = _tenant_id and g.user_id = _user_id and g.app_key <> 'ats' and g.status <> 'revoked'), '[]'::jsonb),
    'google', jsonb_build_object(
      'mail', (select count(*) from public.user_mail_identities where user_id = _user_id and provider = 'gmail'),
      'calendar', (select count(*) from public.calendar_identities where user_id = _user_id and provider = 'google')),
    'open', (select jsonb_build_object('id', o.id, 'steps', o.steps, 'started_at', o.started_at)
             from public.os_offboardings o
             where o.tenant_id = _tenant_id and o.user_id = _user_id and o.finished_at is null)
  );
end $$;
revoke execute on function public.os_offboard_preview(uuid, uuid) from public, anon;
grant execute on function public.os_offboard_preview(uuid, uuid) to authenticated;

-- Step 1, everything inside the ATS database, as the admin who clicked.
create or replace function public.os_offboard_ats(_tenant_id uuid, _user_id uuid)
returns jsonb language plpgsql security definer set search_path = 'public' as $$
declare
  v_id uuid;
  v_seats int := 0;
  v_apps int := 0;
  g record;
begin
  perform public.os_offboard_guard(_tenant_id, _user_id);

  select id into v_id from public.os_offboardings
  where tenant_id = _tenant_id and user_id = _user_id and finished_at is null;
  if v_id is null then
    insert into public.os_offboardings (tenant_id, user_id, started_by)
    values (_tenant_id, _user_id, auth.uid()) returning id into v_id;
  end if;

  -- Job team seats on this workspace's jobs (soft removal, as the job team page does).
  update public.job_assignments ja set deleted_at = now()
  from public.jobs j
  where ja.job_id = j.id and j.tenant_id = _tenant_id
    and ja.user_id = _user_id and ja.deleted_at is null;
  get diagnostics v_seats = row_count;

  -- Gio Sales / Gio Docs access: queued to the apps like any other removal.
  for g in
    select app_key from public.os_app_grants
    where tenant_id = _tenant_id and user_id = _user_id and app_key <> 'ats' and status <> 'revoked'
  loop
    perform public.os_set_app_role(_tenant_id, _user_id, g.app_key, null);
    v_apps := v_apps + 1;
  end loop;

  -- The ATS membership, and People & Access.
  update public.members set user_status = 'inactive'
  where tenant_id = _tenant_id and user_id = _user_id and user_status <> 'inactive';

  insert into public.os_person_profile (tenant_id, user_id, status)
  values (_tenant_id, _user_id, 'offboarded')
  on conflict (tenant_id, user_id) do update set status = 'offboarded';

  update public.os_offboardings
  set steps = steps || jsonb_build_object('ats', jsonb_build_object(
        'status', 'done', 'at', now(), 'seats', v_seats, 'apps', v_apps))
  where id = v_id;

  return jsonb_build_object('id', v_id, 'seats', v_seats, 'apps', v_apps);
end $$;
revoke execute on function public.os_offboard_ats(uuid, uuid) from public, anon;
grant execute on function public.os_offboard_ats(uuid, uuid) to authenticated;
