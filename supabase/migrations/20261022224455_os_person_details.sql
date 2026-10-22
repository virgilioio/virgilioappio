-- Member profile, step 2: personal details (Allan, 2026-10-22).
--
-- A person's personal email, personal phone and where they live (country,
-- state or province, city). Kept apart from profiles, which everyone in the
-- workspace can read: People & Access admins see and edit everyone's, and
-- each person sees and edits only their own (Settings > Profile). The
-- history records which fields changed and who changed them, never the
-- values. Rows are never removed; clearing a field sets it to null.

create table public.os_person_details (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  personal_email text
    check (personal_email is null or (length(personal_email) <= 254 and personal_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  personal_phone text
    check (personal_phone is null or (length(personal_phone) between 5 and 40 and personal_phone ~ '^\+?[0-9 ().-]+$')),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  region text check (region is null or length(region) <= 100),
  city text check (city is null or length(city) <= 100),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

comment on table public.os_person_details is
  'Personal details per person per workspace: People & Access admins and the person themself only.';
comment on column public.os_person_details.country_code is
  'ISO 3166-1 alpha-2, as in src/constants/countries.ts.';

-- Blanks become null, the person must belong to the workspace, and the row
-- can't move to another person or workspace.
create or replace function public.os_person_details_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.personal_email := nullif(lower(btrim(new.personal_email)), '');
  new.personal_phone := nullif(btrim(new.personal_phone), '');
  new.country_code := nullif(upper(btrim(new.country_code)), '');
  new.region := nullif(btrim(new.region), '');
  new.city := nullif(btrim(new.city), '');
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'Personal details can''t move to another person.' using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

create trigger os_person_details_validate
  before insert or update on public.os_person_details
  for each row execute function public.os_person_details_validate();

-- History: which fields changed, by whom. No values, so the log never holds
-- personal data.
create or replace function public.os_person_details_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changed text[] := '{}';
begin
  if new.personal_email is distinct from (case when tg_op = 'UPDATE' then old.personal_email end) then changed := array_append(changed, 'personal_email'); end if;
  if new.personal_phone is distinct from (case when tg_op = 'UPDATE' then old.personal_phone end) then changed := array_append(changed, 'personal_phone'); end if;
  if new.country_code is distinct from (case when tg_op = 'UPDATE' then old.country_code end) then changed := array_append(changed, 'country'); end if;
  if new.region is distinct from (case when tg_op = 'UPDATE' then old.region end) then changed := array_append(changed, 'region'); end if;
  if new.city is distinct from (case when tg_op = 'UPDATE' then old.city end) then changed := array_append(changed, 'city'); end if;
  if cardinality(changed) = 0 then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.details_updated', jsonb_build_object('fields', to_jsonb(changed)));
  return new;
end;
$function$;

create trigger os_person_details_audit
  after insert or update on public.os_person_details
  for each row execute function public.os_person_details_audit();

-- Row level security: the workspace's People & Access admins, or the person
-- themself. Nothing is removed.
alter table public.os_person_details enable row level security;

create policy os_person_details_read on public.os_person_details
  for select to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_details_insert on public.os_person_details
  for insert to authenticated
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_details_update on public.os_person_details
  for update to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid())
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());

grant select, insert, update on public.os_person_details to authenticated;
