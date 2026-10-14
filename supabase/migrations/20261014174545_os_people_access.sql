-- Gio OS: People & Access, Part B schema (design doc, 2026-10-14).
-- Approved by Allan 2026-10-14.
--
-- One place to decide who works at Virgilio and what they can open. All
-- tables are prefixed os_ so ATS code never touches them. Deny by default:
-- only workspace admins and platform admins read or change anything, a
-- person never changes their own access, and every change lands in an
-- append-only audit log written by triggers.
--
-- This migration only adds tables. Nothing syncs to Gio Sales or Gio Docs
-- yet (Part D), and the ATS keeps using members.system_role as today; the
-- ATS grant rows mirror it once the module's screens are built.

-- ---------------------------------------------------------------------------
-- Who may manage People & Access
-- ---------------------------------------------------------------------------
create or replace function public.is_os_admin(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.get_user_type_secure() = 'platform_admin'
    or exists (
      select 1 from public.members m
      where m.tenant_id = _tenant_id
        and m.user_id = auth.uid()
        and m.user_status = 'active'
        and m.system_role = 'admin'
    );
$function$;

revoke execute on function public.is_os_admin(uuid) from public, anon;
grant execute on function public.is_os_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The apps People & Access controls, and the roles each one accepts
-- ---------------------------------------------------------------------------
create table public.os_apps (
  key text primary key check (key ~ '^[a-z][a-z_]{1,30}$'),
  name text not null,
  roles text[] not null check (cardinality(roles) > 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.os_apps is
  'Apps managed by People & Access. roles = that app''s own role names, in its own vocabulary.';

insert into public.os_apps (key, name, roles, sort_order) values
  ('ats',   'Gio ATS',   array['admin', 'member', 'sales'],           1),
  ('sales', 'Gio Sales', array['read_only', 'rep', 'admin', 'owner'], 2),
  ('docs',  'Gio Docs',  array['member', 'owner'],                    3);

-- ---------------------------------------------------------------------------
-- Job-role bundles: picking a job role grants these app roles
-- ---------------------------------------------------------------------------
create table public.os_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null check (length(btrim(name)) between 1 and 60),
  description text check (description is null or length(description) <= 280),
  grants jsonb not null default '[]'::jsonb,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index os_bundles_name_unique
  on public.os_bundles (tenant_id, lower(btrim(name)))
  where archived_at is null;

comment on column public.os_bundles.grants is
  'Array of {"app": os_apps.key, "role": one of that app''s roles}, at most one entry per app.';

-- ---------------------------------------------------------------------------
-- A person's job role and status, on top of their ATS membership
-- ---------------------------------------------------------------------------
create table public.os_person_profile (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  bundle_id uuid references public.os_bundles(id),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'offboarded')),
  offboarded_at timestamptz,
  offboarded_by uuid,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  check ((status = 'offboarded') = (offboarded_at is not null))
);

-- ---------------------------------------------------------------------------
-- What each person can open, one row per person per app
-- ---------------------------------------------------------------------------
create table public.os_app_grants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  app_key text not null references public.os_apps(key),
  role text not null,
  -- pending: waiting to reach the app · active: the app confirmed it ·
  -- error: the app refused or couldn't be reached (sync_error says why) ·
  -- revoked: removed, kept for history.
  status text not null default 'pending'
    check (status in ('pending', 'active', 'error', 'revoked')),
  granted_by uuid default auth.uid(),
  granted_at timestamptz not null default now(),
  synced_at timestamptz,
  sync_error text check (sync_error is null or length(sync_error) <= 500),
  revoked_by uuid,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);

create unique index os_app_grants_one_live
  on public.os_app_grants (tenant_id, user_id, app_key)
  where status <> 'revoked';
create index os_app_grants_user on public.os_app_grants (user_id);

-- ---------------------------------------------------------------------------
-- Append-only history
-- ---------------------------------------------------------------------------
create table public.os_audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id),
  actor_id uuid,
  subject_user_id uuid,
  action text not null,
  app_key text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index os_audit_log_subject on public.os_audit_log (tenant_id, subject_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Rules the database enforces
-- ---------------------------------------------------------------------------

-- Bundle grants name real apps and roles, once per app.
create or replace function public.os_bundles_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  g jsonb;
  seen text[] := '{}';
begin
  if jsonb_typeof(new.grants) <> 'array' then
    raise exception 'Bundle grants must be a list.' using errcode = 'GOS01';
  end if;
  for g in select * from jsonb_array_elements(new.grants) loop
    if not exists (
      select 1 from public.os_apps a
      where a.key = g->>'app' and (g->>'role') = any (a.roles)
    ) then
      raise exception '% is not a role in %.', coalesce(g->>'role', 'An empty role'), coalesce(g->>'app', 'an unnamed app')
        using errcode = 'GOS01';
    end if;
    if (g->>'app') = any (seen) then
      raise exception 'A bundle can grant each app only once.' using errcode = 'GOS01';
    end if;
    seen := seen || (g->>'app');
  end loop;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_bundles_validate
  before insert or update on public.os_bundles
  for each row execute function public.os_bundles_validate();

-- Grants: the role belongs to the app, the person is a member of the
-- workspace, nobody changes their own access, and a revoked row stays
-- revoked (a new grant is a new row).
create or replace function public.os_app_grants_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.os_apps a where a.key = new.app_key and new.role = any (a.roles)) then
    raise exception '% is not a role in %.', new.role, new.app_key using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  if auth.uid() is not null and new.user_id = auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can''t change your own access. Ask another admin.' using errcode = 'GOS03';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'revoked' then
      raise exception 'A removed grant can''t be changed. Grant the app again instead.' using errcode = 'GOS02';
    end if;
    if new.tenant_id <> old.tenant_id or new.user_id <> old.user_id or new.app_key <> old.app_key then
      raise exception 'A grant''s person and app can''t change.' using errcode = 'GOS02';
    end if;
    if new.status = 'revoked' and old.status <> 'revoked' then
      new.revoked_at := coalesce(new.revoked_at, now());
      new.revoked_by := coalesce(new.revoked_by, auth.uid());
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_app_grants_validate
  before insert or update on public.os_app_grants
  for each row execute function public.os_app_grants_validate();

create or replace function public.os_person_profile_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  if auth.uid() is not null and new.user_id = auth.uid() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'You can''t change your own access. Ask another admin.' using errcode = 'GOS03';
  end if;
  if new.bundle_id is not null and not exists (
    select 1 from public.os_bundles b where b.id = new.bundle_id and b.tenant_id = new.tenant_id
  ) then
    raise exception 'That job role belongs to another workspace.' using errcode = 'GOS02';
  end if;
  if new.status = 'offboarded' then
    new.offboarded_at := coalesce(new.offboarded_at, now());
    new.offboarded_by := coalesce(new.offboarded_by, auth.uid());
  else
    new.offboarded_at := null;
    new.offboarded_by := null;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_person_profile_validate
  before insert or update on public.os_person_profile
  for each row execute function public.os_person_profile_validate();

-- History: every insert and change, written by the database.
create or replace function public.os_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  subject uuid;
  app text;
  act text;
  det jsonb;
begin
  if tg_table_name = 'os_app_grants' then
    subject := new.user_id;
    app := new.app_key;
    act := case
      when tg_op = 'INSERT' then 'grant.added'
      when new.status = 'revoked' and old.status <> 'revoked' then 'grant.removed'
      when new.role <> old.role then 'grant.role_changed'
      when new.status <> old.status then 'grant.' || new.status
      else 'grant.updated' end;
    det := jsonb_build_object('role', new.role, 'status', new.status)
      || case when tg_op = 'UPDATE' then jsonb_build_object('previous_role', old.role, 'previous_status', old.status) else '{}'::jsonb end
      || case when new.sync_error is not null then jsonb_build_object('sync_error', new.sync_error) else '{}'::jsonb end;
  elsif tg_table_name = 'os_person_profile' then
    subject := new.user_id;
    act := case
      when tg_op = 'INSERT' then 'person.added'
      when new.status <> old.status then 'person.' || new.status
      else 'person.updated' end;
    det := jsonb_build_object('status', new.status, 'bundle_id', new.bundle_id)
      || case when tg_op = 'UPDATE' then jsonb_build_object('previous_status', old.status, 'previous_bundle_id', old.bundle_id) else '{}'::jsonb end;
  else
    act := case when tg_op = 'INSERT' then 'bundle.added'
                when new.archived_at is not null and old.archived_at is null then 'bundle.archived'
                else 'bundle.updated' end;
    det := jsonb_build_object('bundle_id', new.id, 'name', new.name, 'grants', new.grants);
  end if;

  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, app_key, detail)
  values (new.tenant_id, auth.uid(), subject, act, app, det);
  return new;
end;
$function$;

create trigger os_app_grants_audit
  after insert or update on public.os_app_grants
  for each row execute function public.os_audit();
create trigger os_person_profile_audit
  after insert or update on public.os_person_profile
  for each row execute function public.os_audit();
create trigger os_bundles_audit
  after insert or update on public.os_bundles
  for each row execute function public.os_audit();

-- ---------------------------------------------------------------------------
-- Row level security: admins and platform admins only; nothing is deleted
-- (grants are revoked, bundles archived, people offboarded)
-- ---------------------------------------------------------------------------
alter table public.os_apps enable row level security;
alter table public.os_bundles enable row level security;
alter table public.os_person_profile enable row level security;
alter table public.os_app_grants enable row level security;
alter table public.os_audit_log enable row level security;

create policy os_apps_read on public.os_apps
  for select to authenticated
  using (exists (select 1 from public.members m where m.user_id = auth.uid() and m.user_status = 'active' and public.is_os_admin(m.tenant_id)));

create policy os_bundles_read on public.os_bundles
  for select to authenticated using (public.is_os_admin(tenant_id));
create policy os_bundles_insert on public.os_bundles
  for insert to authenticated with check (public.is_os_admin(tenant_id));
create policy os_bundles_update on public.os_bundles
  for update to authenticated using (public.is_os_admin(tenant_id)) with check (public.is_os_admin(tenant_id));

create policy os_person_profile_read on public.os_person_profile
  for select to authenticated using (public.is_os_admin(tenant_id));
create policy os_person_profile_insert on public.os_person_profile
  for insert to authenticated with check (public.is_os_admin(tenant_id));
create policy os_person_profile_update on public.os_person_profile
  for update to authenticated using (public.is_os_admin(tenant_id)) with check (public.is_os_admin(tenant_id));

create policy os_app_grants_read on public.os_app_grants
  for select to authenticated using (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_app_grants_insert on public.os_app_grants
  for insert to authenticated with check (public.is_os_admin(tenant_id));
create policy os_app_grants_update on public.os_app_grants
  for update to authenticated using (public.is_os_admin(tenant_id)) with check (public.is_os_admin(tenant_id));

create policy os_audit_log_read on public.os_audit_log
  for select to authenticated using (public.is_os_admin(tenant_id));

-- ---------------------------------------------------------------------------
-- Starting job-role bundles for Virgilio (brief values; Allan edits them in
-- the module). F&A gets no Gio Sales role until a Billing role exists.
-- ---------------------------------------------------------------------------
insert into public.os_bundles (tenant_id, name, description, grants, created_by) values
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'Admin / TA Ops', 'Runs the workspace and seats TA and Sourcers on jobs.',
   '[{"app":"ats","role":"admin"},{"app":"sales","role":"admin"},{"app":"docs","role":"owner"}]', null),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'Sales', 'Works deals in Gio Sales.',
   '[{"app":"sales","role":"rep"},{"app":"docs","role":"member"}]', null),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'Engagement Specialist', 'Owns the customer relationship from win to kick-off.',
   '[{"app":"ats","role":"member"},{"app":"sales","role":"rep"},{"app":"docs","role":"member"}]', null),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'TA / Sourcer', 'Recruits on the jobs an admin seats them on.',
   '[{"app":"ats","role":"member"},{"app":"docs","role":"member"}]', null),
  ('5ba7b145-f251-4b18-8900-724cb06028ab', 'F&A', 'Invoicing and collections.',
   '[{"app":"docs","role":"member"}]', null);
