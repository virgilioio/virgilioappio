-- Member profile, step 3: work profile (Allan, 2026-10-23).
--
-- os_person_work: what a person works on and how much they can take, so
-- whoever staffs a job can see it. Segments (SMB, MM, ENT), specialties (a
-- fixed list of job areas, so they stay comparable) and a maximum number of
-- open jobs. Everyone in the workspace reads it; People & Access admins edit
-- it. The load ("9 of 12") is counted live from the person's seats on open
-- jobs, never stored.
--
-- os_person_rating: a manager's 1-5 rating with a private note, who rated and
-- when. People & Access admins only; the person doesn't see it. The computed
-- numbers (step 4) sit beside it on the profile.
--
-- Both write to the person's history (os_audit_log, admins only): the work
-- fields with their new values, the rating with its value, the note only as
-- "changed". Rows are never removed; clearing a field sets it to null or {}.

create table public.os_person_work (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  segments text[] not null default '{}'
    check (segments <@ array['smb', 'mm', 'ent']::text[]),
  specialties text[] not null default '{}'
    check (specialties <@ array['sales', 'engineering', 'customer_success', 'marketing', 'operations',
                                'finance', 'people', 'product', 'data', 'executive']::text[]),
  max_open_jobs smallint check (max_open_jobs is null or max_open_jobs between 1 and 200),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

comment on table public.os_person_work is
  'Work profile per person per workspace: segments, specialties, capacity. Everyone in the workspace reads; People & Access admins edit.';
comment on column public.os_person_work.specialties is
  'Keys of SPECIALTIES in src/lib/os/workProfile.ts.';
comment on column public.os_person_work.max_open_jobs is
  'Capacity: the most open jobs this person should hold a seat on. Null means not set.';

create table public.os_person_rating (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  rating smallint check (rating is null or rating between 1 and 5),
  note text check (note is null or length(note) <= 2000),
  rated_by uuid default auth.uid(),
  rated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

comment on table public.os_person_rating is
  'A manager''s 1-5 rating of a person, with a private note. People & Access admins only.';

-- Shared checks: the person belongs to the workspace and the row can't move.
create or replace function public.os_person_work_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'A work profile can''t move to another person.' using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  -- One of each, in a fixed order, so the history reads the same way every time.
  new.segments := array(select s from unnest(new.segments) s group by s
                        order by array_position(array['smb', 'mm', 'ent'], s));
  new.specialties := array(select s from unnest(new.specialties) s group by s order by s);
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_person_work_validate
  before insert or update on public.os_person_work
  for each row execute function public.os_person_work_validate();

create or replace function public.os_person_rating_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'A rating can''t move to another person.' using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  if new.user_id = auth.uid() then
    raise exception 'You can''t rate yourself.' using errcode = 'GOS03';
  end if;
  new.note := nullif(btrim(new.note), '');
  if tg_op = 'INSERT' or new.rating is distinct from old.rating or new.note is distinct from old.note then
    new.rated_by := auth.uid();
    new.rated_at := now();
  else
    new.rated_by := old.rated_by;
    new.rated_at := old.rated_at;
  end if;
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_person_rating_validate
  before insert or update on public.os_person_rating
  for each row execute function public.os_person_rating_validate();

-- History.
create or replace function public.os_person_work_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changes jsonb := '{}';
begin
  if new.segments is distinct from (case when tg_op = 'UPDATE' then old.segments end) then
    changes := changes || jsonb_build_object('segments', to_jsonb(new.segments));
  end if;
  if new.specialties is distinct from (case when tg_op = 'UPDATE' then old.specialties end) then
    changes := changes || jsonb_build_object('specialties', to_jsonb(new.specialties));
  end if;
  if new.max_open_jobs is distinct from (case when tg_op = 'UPDATE' then old.max_open_jobs end) then
    changes := changes || jsonb_build_object('max_open_jobs', new.max_open_jobs);
  end if;
  if changes = '{}' then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.work_updated', changes);
  return new;
end;
$function$;

create trigger os_person_work_audit
  after insert or update on public.os_person_work
  for each row execute function public.os_person_work_audit();

create or replace function public.os_person_rating_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changes jsonb := '{}';
begin
  if new.rating is distinct from (case when tg_op = 'UPDATE' then old.rating end) then
    changes := changes || jsonb_build_object('rating', new.rating);
  end if;
  if new.note is distinct from (case when tg_op = 'UPDATE' then old.note end) then
    changes := changes || jsonb_build_object('note_changed', true);
  end if;
  if changes = '{}' then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.rating_updated', changes);
  return new;
end;
$function$;

create trigger os_person_rating_audit
  after insert or update on public.os_person_rating
  for each row execute function public.os_person_rating_audit();

-- Row level security.
alter table public.os_person_work enable row level security;

create policy os_person_work_read on public.os_person_work
  for select to authenticated
  using (public.is_os_admin(tenant_id) or public.user_has_active_tenant_membership(tenant_id));
create policy os_person_work_insert on public.os_person_work
  for insert to authenticated
  with check (public.is_os_admin(tenant_id));
create policy os_person_work_update on public.os_person_work
  for update to authenticated
  using (public.is_os_admin(tenant_id))
  with check (public.is_os_admin(tenant_id));

grant select, insert, update on public.os_person_work to authenticated;

alter table public.os_person_rating enable row level security;

create policy os_person_rating_read on public.os_person_rating
  for select to authenticated
  using (public.is_os_admin(tenant_id));
create policy os_person_rating_insert on public.os_person_rating
  for insert to authenticated
  with check (public.is_os_admin(tenant_id));
create policy os_person_rating_update on public.os_person_rating
  for update to authenticated
  using (public.is_os_admin(tenant_id))
  with check (public.is_os_admin(tenant_id));

grant select, insert, update on public.os_person_rating to authenticated;
