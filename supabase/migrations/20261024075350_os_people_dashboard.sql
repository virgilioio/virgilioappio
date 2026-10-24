-- People & Access dashboard (Allan, 2026-10-24): birthdays, work anniversaries
-- and public holidays, for admins on the dashboard and for everyone on My
-- profile, with a bell to admins the day before.
--
-- 1. Date of birth: os_person_details.birth_date (the person and People &
--    Access admins read it, like the rest of Personal). The year never leaves
--    those two: every other view gets only the next day it falls on.
-- 2. Start date: os_person_work.start_date (the workspace reads it, admins set
--    it), for work anniversaries.
-- 3. Holidays: os_holidays. Public calendars come from Nager.Date for every
--    country in the tax ID catalogue and every country people live in, this
--    year and next, fetched by the database itself (pg_net) every hour until
--    each country and year is in (os_holiday_fetches). Nager.Date has no India,
--    so India's three national holidays are added as fixed dates. Admins add
--    their workspace's own (Diwali, a company day off), archived, never erased.
-- 4. os_people_dashboard: the dashboard's numbers, admins only.
--    os_team_calendar: upcoming birthdays (day and month only) and the holidays
--    in your own country, for every active member.
-- 5. os_people_bells: the day before a birthday or a holiday, every active
--    admin's bell rings (category team), never the birthday person's own.
--    Days are Mexico City days.

-- 1. Date of birth.
alter table public.os_person_details add column birth_date date;

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
  if new.birth_date is not null and (new.birth_date < date '1900-01-01' or new.birth_date > current_date - interval '14 years') then
    raise exception 'Check the date of birth.' using errcode = 'GOS02';
  end if;
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
  if new.birth_date is distinct from (case when tg_op = 'UPDATE' then old.birth_date end) then changed := array_append(changed, 'birthday'); end if;
  if cardinality(changed) = 0 then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.details_updated', jsonb_build_object('fields', to_jsonb(changed)));
  return new;
end;
$function$;

-- 2. Start date.
alter table public.os_person_work add column start_date date
  check (start_date is null or start_date between date '1980-01-01' and date '2100-01-01');

-- The next time a day and month come round, on or after _from. A 29 February
-- falls on the 28th in other years.
create or replace function public.os_next_occurrence(_d date, _from date)
returns date
language plpgsql
immutable
as $function$
declare
  c date;
begin
  if _d is null or _from is null then return null; end if;
  for k in 0..1 loop
    c := make_date(extract(year from _from)::int + k, extract(month from _d)::int, 1);
    c := c + (least(extract(day from _d)::int, extract(day from (c + interval '1 month' - interval '1 day'))::int) - 1);
    if c >= _from then return c; end if;
  end loop;
  return null;
end;
$function$;

-- Today in Mexico City, the day every reminder and list counts from.
create or replace function public.os_today()
returns date
language sql
stable
as $function$
  select (now() at time zone 'America/Mexico_City')::date;
$function$;

-- 3. Holidays.
create table public.os_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  day date not null,
  name text not null check (length(name) between 1 and 120),
  local_name text check (local_name is null or length(local_name) <= 120),
  source text not null check (source in ('nager', 'fixed', 'manual')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check ((tenant_id is null) = (source <> 'manual'))
);
comment on table public.os_holidays is
  'Public holidays by country (Nager.Date, or fixed dates for India) and each workspace''s own days off (manual, archived not erased).';
create unique index os_holidays_one on public.os_holidays
  (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), country_code, day, name);
create index os_holidays_day on public.os_holidays (day) where archived_at is null;

alter table public.os_holidays enable row level security;
create policy os_holidays_read on public.os_holidays for select to authenticated
  using (tenant_id is null or public.user_has_active_tenant_membership(tenant_id));
create policy os_holidays_insert on public.os_holidays for insert to authenticated
  with check (tenant_id is not null and source = 'manual' and public.is_os_admin(tenant_id));
create policy os_holidays_update on public.os_holidays for update to authenticated
  using (tenant_id is not null and source = 'manual' and public.is_os_admin(tenant_id))
  with check (tenant_id is not null and source = 'manual' and public.is_os_admin(tenant_id));
revoke all on public.os_holidays from anon, authenticated;
grant select, insert, update on public.os_holidays to authenticated;

create table public.os_holiday_fetches (
  country_code text not null,
  year int not null,
  request_id bigint,
  requested_at timestamptz,
  attempts int not null default 0,
  status text not null default 'waiting' check (status in ('waiting', 'done', 'unsupported', 'failed')),
  holidays int,
  done_at timestamptz,
  primary key (country_code, year)
);
comment on table public.os_holiday_fetches is
  'Which country and year of public holidays have been fetched from Nager.Date (os_holidays_sync).';
alter table public.os_holiday_fetches enable row level security;
revoke all on public.os_holiday_fetches from anon, authenticated;

-- Settles answered requests, adds India's fixed days, and asks Nager.Date for
-- any country and year still missing. Runs every hour.
create or replace function public.os_holidays_sync(_queue boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  f record;
  r record;
  n int;
  settled int := 0;
  queued int := 0;
  y int := extract(year from public.os_today())::int;
begin
  for f in select * from public.os_holiday_fetches where status = 'waiting' and request_id is not null loop
    select status_code, content into r from net._http_response where id = f.request_id;
    if not found then
      if f.requested_at < now() - interval '1 hour' then
        update public.os_holiday_fetches set request_id = null where country_code = f.country_code and year = f.year;
      end if;
      continue;
    end if;
    if r.status_code = 200 then
      insert into public.os_holidays (tenant_id, country_code, day, name, local_name, source)
      select null, f.country_code, (e->>'date')::date, left(e->>'name', 120), left(nullif(e->>'localName', ''), 120), 'nager'
      from jsonb_array_elements(r.content::jsonb) e
      where coalesce((e->>'global')::boolean, true) and coalesce(e->'types', '["Public"]'::jsonb) ? 'Public'
      on conflict do nothing;
      get diagnostics n = row_count;
      update public.os_holiday_fetches set status = 'done', holidays = n, done_at = now()
      where country_code = f.country_code and year = f.year;
    elsif r.status_code in (204, 404) then
      update public.os_holiday_fetches set status = 'unsupported', done_at = now()
      where country_code = f.country_code and year = f.year;
    else
      update public.os_holiday_fetches
      set request_id = null, status = case when attempts >= 5 then 'failed' else 'waiting' end
      where country_code = f.country_code and year = f.year;
    end if;
    settled := settled + 1;
  end loop;

  insert into public.os_holidays (tenant_id, country_code, day, name, local_name, source)
  select null, 'IN', make_date(yy, d.m, d.dd), d.name, d.local_name, 'fixed'
  from generate_series(y, y + 1) yy
  cross join (values (1, 26, 'Republic Day', 'Gantantra Divas'), (8, 15, 'Independence Day', 'Swatantrata Divas'), (10, 2, 'Gandhi Jayanti', 'Gandhi Jayanti'))
    as d(m, dd, name, local_name)
  on conflict do nothing;

  if _queue then
    for f in
      select c.code, yy
      from (select country_code as code from public.os_tax_id_types where country_code is not null
            union select country_code from public.os_person_details where country_code is not null) c
      cross join generate_series(y, y + 1) yy
      where c.code <> 'IN'
        and not exists (
          select 1 from public.os_holiday_fetches x
          where x.country_code = c.code and x.year = yy
            and (x.status in ('done', 'unsupported', 'failed') or (x.request_id is not null and x.requested_at > now() - interval '1 hour')))
    loop
      insert into public.os_holiday_fetches as x (country_code, year, request_id, requested_at, attempts, status)
      values (f.code, f.yy, net.http_get('https://date.nager.at/api/v3/PublicHolidays/' || f.yy || '/' || f.code), now(), 1, 'waiting')
      on conflict (country_code, year) do update
        set request_id = excluded.request_id, requested_at = now(), attempts = x.attempts + 1, status = 'waiting';
      queued := queued + 1;
    end loop;
  end if;
  return jsonb_build_object('settled', settled, 'queued', queued);
end;
$function$;
revoke all on function public.os_holidays_sync(boolean) from public, anon, authenticated;

-- The people a workspace counts: active members with their name and photo.
create or replace function public.os_active_people(_tenant_id uuid)
returns table(user_id uuid, member_id uuid, name text, avatar_url text, country_code text, birth_date date,
              start_date date, max_open_jobs int)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.user_id, m.id,
    coalesce(nullif(btrim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email, m.invited_email),
    p.avatar_url, d.country_code, d.birth_date, w.start_date, w.max_open_jobs
  from public.members m
  left join public.profiles p on p.user_id = m.user_id
  left join public.os_person_details d on d.tenant_id = m.tenant_id and d.user_id = m.user_id
  left join public.os_person_work w on w.tenant_id = m.tenant_id and w.user_id = m.user_id
  where m.tenant_id = _tenant_id and m.user_status = 'active' and m.user_id is not null;
$function$;
revoke all on function public.os_active_people(uuid) from public, anon, authenticated;

-- Holidays from _from for _days days, in the given countries plus the
-- workspace's own, each with how many of its people live there.
create or replace function public.os_holidays_between(_tenant_id uuid, _from date, _days int, _countries text[])
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', h.id, 'date', h.day, 'name', h.name, 'local_name', h.local_name, 'country_code', h.country_code,
      'own', h.tenant_id is not null, 'people', coalesce(pp.people, 0), 'names', coalesce(pp.names, '[]'::jsonb))
    order by h.day, h.country_code, h.name), '[]'::jsonb)
  from public.os_holidays h
  left join lateral (
    select count(*) as people, jsonb_agg(a.name order by a.name) filter (where a.name is not null) as names
    from public.os_active_people(_tenant_id) a where a.country_code = h.country_code
  ) pp on true
  where h.archived_at is null
    and h.day between _from and _from + _days
    and ((h.tenant_id is null and h.country_code = any(_countries)) or h.tenant_id = _tenant_id);
$function$;
revoke all on function public.os_holidays_between(uuid, date, int, text[]) from public, anon, authenticated;

-- 4. The dashboard (admins).
create or replace function public.os_people_dashboard(_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  today date := public.os_today();
  out jsonb;
begin
  if not public.is_os_admin(_tenant_id) then
    raise exception 'Only People & Access admins see the dashboard.' using errcode = 'GPD01';
  end if;
  with people as (
    select a.*,
      (select count(distinct ja.job_id) from public.job_assignments ja join public.jobs j on j.id = ja.job_id
        where ja.user_id = a.user_id and ja.deleted_at is null and j.tenant_id = _tenant_id and j.status = 'open') as open_jobs,
      exists (select 1 from public.os_person_tax_ids t where t.tenant_id = _tenant_id and t.user_id = a.user_id and t.removed_at is null) as has_tax,
      exists (select 1 from public.os_person_bank b where b.tenant_id = _tenant_id and b.user_id = a.user_id) as has_bank
    from public.os_active_people(_tenant_id) a
  ), marked as (
    select p.*,
      array_remove(array[
        case when p.country_code is null then 'country' end,
        case when not p.has_tax then 'tax_id' end,
        case when not p.has_bank then 'bank' end,
        case when p.birth_date is null then 'birthday' end], null) as missing,
      case when p.max_open_jobs is null then 'unset'
           when p.open_jobs > p.max_open_jobs then 'over'
           when p.open_jobs >= ceil(p.max_open_jobs * 0.8) then 'near'
           else 'ok' end as load
    from people p
  )
  select jsonb_build_object(
    'today', today,
    'active', (select count(*) from marked),
    'invited', (select count(*) from public.members m where m.tenant_id = _tenant_id and m.user_status = 'invited'),
    'complete', (select count(*) from marked where country_code is not null and has_tax and has_bank),
    'near_capacity', (select count(*) from marked where load = 'near'),
    'over_capacity', (select count(*) from marked where load = 'over'),
    'birthdays', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'member_id', x.member_id, 'name', x.name,
        'avatar_url', x.avatar_url, 'date', x.next) order by x.next, x.name)
      from (select m.*, public.os_next_occurrence(m.birth_date, today) as next from marked m where m.birth_date is not null) x
      where x.next <= today + 30), '[]'::jsonb),
    'anniversaries', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'member_id', x.member_id, 'name', x.name,
        'avatar_url', x.avatar_url, 'date', x.next, 'years', extract(year from x.next)::int - extract(year from x.start_date)::int)
        order by x.next, x.name)
      from (select m.*, public.os_next_occurrence(m.start_date, today) as next from marked m where m.start_date is not null) x
      where x.next <= today + 30 and extract(year from x.next) > extract(year from x.start_date)), '[]'::jsonb),
    'holidays', public.os_holidays_between(_tenant_id, today, 60,
      coalesce((select array_agg(distinct country_code) from marked where country_code is not null), '{}')),
    'by_country', coalesce((select jsonb_agg(jsonb_build_object('country_code', c.country_code, 'people', c.n) order by c.n desc, c.country_code nulls last)
      from (select country_code, count(*) as n from marked group by country_code) c), '[]'::jsonb),
    'missing', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_id', m.member_id, 'name', m.name,
        'avatar_url', m.avatar_url, 'missing', to_jsonb(m.missing)) order by cardinality(m.missing) desc, m.name)
      from marked m where cardinality(m.missing) > 0), '[]'::jsonb),
    'load', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_id', m.member_id, 'name', m.name,
        'avatar_url', m.avatar_url, 'open_jobs', m.open_jobs, 'max_open_jobs', m.max_open_jobs, 'load', m.load)
        order by (m.open_jobs::numeric / nullif(m.max_open_jobs, 0)) desc nulls last, m.open_jobs desc)
      from marked m where m.load in ('near', 'over')), '[]'::jsonb)
  ) into out from (select 1) one;
  return out;
end;
$function$;
revoke all on function public.os_people_dashboard(uuid) from public, anon;
grant execute on function public.os_people_dashboard(uuid) to authenticated;

-- My profile (every active member): teammates' birthdays as day and month,
-- and the holidays where you live plus the workspace's own.
create or replace function public.os_team_calendar(_tenant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  today date := public.os_today();
  mine text;
begin
  if auth.uid() is null or not exists (
      select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = auth.uid() and m.user_status = 'active') then
    raise exception 'Only members of this workspace see its calendar.' using errcode = 'GPD01';
  end if;
  select d.country_code into mine from public.os_person_details d where d.tenant_id = _tenant_id and d.user_id = auth.uid();
  return jsonb_build_object(
    'today', today,
    'country_code', mine,
    'birthdays', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.user_id, 'name', x.name, 'avatar_url', x.avatar_url,
        'date', x.next, 'mine', x.user_id = auth.uid()) order by x.next, x.name)
      from (select a.*, public.os_next_occurrence(a.birth_date, today) as next
            from public.os_active_people(_tenant_id) a where a.birth_date is not null) x
      where x.next <= today + 30), '[]'::jsonb),
    'holidays', public.os_holidays_between(_tenant_id, today, 60, case when mine is null then '{}'::text[] else array[mine] end));
end;
$function$;
revoke all on function public.os_team_calendar(uuid) from public, anon;
grant execute on function public.os_team_calendar(uuid) to authenticated;

-- 5. The bell the day before, for every active admin (never about yourself).
alter type public.notification_category add value if not exists 'team';

-- A country's name for the bell: the countries in the tax ID catalogue, or the code.
create or replace function public.os_country_label(_code text)
returns text
language sql
immutable
as $function$
  select case upper(coalesce(_code, ''))
    when 'MX' then 'Mexico' when 'CO' then 'Colombia' when 'US' then 'the United States'
    when 'AR' then 'Argentina' when 'BR' then 'Brazil' when 'CL' then 'Chile' when 'PE' then 'Peru'
    when 'ES' then 'Spain' when 'CA' then 'Canada' when 'NL' then 'the Netherlands' when 'IN' then 'India'
    when 'PH' then 'the Philippines' else upper(_code) end;
$function$;

create or replace function public.os_people_bells()
returns int
language plpgsql
volatile
security definer
set search_path to 'public'
as $function$
declare
  tomorrow date := public.os_today() + 1;
  t record;
  ev record;
  rung int := 0;
  n int;
begin
  for t in
    select distinct m.tenant_id from public.members m
    where m.user_status = 'active' and m.system_role = 'admin'
  loop
    for ev in
      select 'birthday' as kind, a.user_id::text as subject, a.user_id as about,
        a.name || '''s birthday is tomorrow' as title,
        to_char(tomorrow, 'FMDay, Mon FMDD') as subtitle, '/os' as url
      from public.os_active_people(t.tenant_id) a
      where public.os_next_occurrence(a.birth_date, tomorrow) = tomorrow
      union all
      select 'holiday', h.id::text, null,
        'Tomorrow is ' || h.name || case when h.own then '' else ' in ' || public.os_country_label(h.country_code) end,
        case when h.people = 0 then to_char(tomorrow, 'FMDay, Mon FMDD')
             when h.people = 1 then '1 person lives there: ' || (h.names->>0)
             else h.people || ' people live there: ' || (h.names->>0) || ' and ' || (h.people - 1) || ' more' end,
        '/os'
      from (select (e->>'id') as id, e->>'name' as name, e->>'country_code' as country_code, (e->>'own')::boolean as own,
                   (e->>'people')::int as people, e->'names' as names
            from jsonb_array_elements(public.os_holidays_between(t.tenant_id, tomorrow, 0,
              coalesce((select array_agg(distinct a.country_code) from public.os_active_people(t.tenant_id) a where a.country_code is not null), '{}'))) e
            where (e->>'date')::date = tomorrow) h
    loop
      insert into public.notifications (user_id, tenant_id, category, actor_user_id, actor_name, title, subtitle,
                                        entity_kind, entity_id, action_url, metadata)
      select m.user_id, t.tenant_id, 'team'::public.notification_category, null, null, ev.title, ev.subtitle,
             'person', ev.about, ev.url,
             jsonb_build_object('kind', ev.kind || '_tomorrow', 'subject', ev.subject, 'day', tomorrow)
      from public.members m
      where m.tenant_id = t.tenant_id and m.user_status = 'active' and m.system_role = 'admin'
        and m.user_id is distinct from ev.about
        and not exists (
          select 1 from public.notifications x
          where x.user_id = m.user_id and x.metadata->>'kind' = ev.kind || '_tomorrow'
            and x.metadata->>'subject' = ev.subject and x.metadata->>'day' = tomorrow::text);
      get diagnostics n = row_count;
      rung := rung + n;
    end loop;
  end loop;
  return rung;
end;
$function$;
revoke all on function public.os_people_bells() from public, anon, authenticated;

select cron.schedule('os-holidays-sync', '23 * * * *', $cron$ select public.os_holidays_sync() $cron$);
select cron.schedule('os-people-bells', '5 14 * * *', $cron$ select public.os_people_bells() $cron$);
