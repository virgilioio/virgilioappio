-- Places and shipping addresses (Allan, 2026-10-26).
--
-- 1. Places: every country's states and provinces and every city with 5,000
--    people or more, from GeoNames (CC BY 4.0), so a location is picked
--    Country → State or province → City instead of typed. Reference data:
--    anyone may read it, the careers pages included (anon); only the server
--    writes it (the geo-load Edge Function, with the service role). Nothing
--    about how locations are stored changes: candidates keep their text
--    columns and members their country code, state and city.
-- 2. Shipping addresses: where Virgilio sends a person swag or mail. Kept like
--    personal details: People & Access admins and the person themself only,
--    never external users (GEX02), the history names the fields that changed
--    and never their values, and rows are never removed.

-- 1. Places --------------------------------------------------------------------

-- Lower case without accents, so "san pedro" finds "San Pedro Garza García".
-- The browser folds what is typed the same way before it searches.
create or replace function public.geo_fold(_t text)
returns text
language sql
immutable
parallel safe
set search_path to 'public'
as $function$
  select lower(translate(coalesce(_t, ''),
    'ÁÀÂÄÃÅáàâäãåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÖÕØóòôöõøÚÙÛÜúùûüÑñÇçÝýÿŠšŽžĆćČčŁłŃńŚśŹźŻżĞğİıŞşŐőŰűȘșȚțĂăÂâÎî',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuNnCcYyySsZzCcCcLlNnSsZzZzGgIiSsOoUuSsTtAaAaIi'))
$function$;

create table public.geo_regions (
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  code text not null check (length(code) between 1 and 20),
  name text not null check (length(name) between 1 and 200),
  ascii_name text,
  geoname_id integer,
  primary key (country_code, code)
);

comment on table public.geo_regions is
  'States and provinces (GeoNames first-level divisions, CC BY 4.0). Read by anyone, written by geo-load.';

create table public.geo_cities (
  id integer primary key,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  region_code text,
  name text not null check (length(name) between 1 and 200),
  ascii_name text,
  search_name text generated always as (public.geo_fold(coalesce(nullif(ascii_name, ''), name))) stored,
  population integer not null default 0
);

comment on table public.geo_cities is
  'Cities of 5,000 people or more (GeoNames cities5000, CC BY 4.0). Read by anyone, written by geo-load.';

create index geo_cities_country_search on public.geo_cities (country_code, search_name text_pattern_ops);
create index geo_cities_country_region on public.geo_cities (country_code, region_code, population desc);

alter table public.geo_regions enable row level security;
alter table public.geo_cities enable row level security;

create policy geo_regions_read on public.geo_regions for select to anon, authenticated using (true);
create policy geo_cities_read on public.geo_cities for select to anon, authenticated using (true);

-- New tables come with every right for anon and authenticated; keep only reading.
revoke all on public.geo_regions from anon, authenticated;
revoke all on public.geo_cities from anon, authenticated;
grant select on public.geo_regions to anon, authenticated;
grant select on public.geo_cities to anon, authenticated;

-- A country's cities, biggest first, optionally inside one state and matching
-- what was typed (from the start of the name or of any word in it).
create or replace function public.geo_cities_search(_country text, _region text default null, _q text default null, _limit integer default 20)
returns table (id integer, name text, region_code text, region_name text, population integer)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  select c.id, c.name, c.region_code, r.name, c.population
  from public.geo_cities c
  left join public.geo_regions r on r.country_code = c.country_code and r.code = c.region_code
  where c.country_code = upper(btrim(_country))
    and (nullif(btrim(_region), '') is null or c.region_code = btrim(_region))
    and (
      nullif(btrim(_q), '') is null
      or c.search_name like public.geo_fold(btrim(_q)) || '%'
      or c.search_name like '% ' || public.geo_fold(btrim(_q)) || '%'
    )
  order by c.population desc, c.name
  limit least(greatest(coalesce(_limit, 20), 1), 50)
$function$;

grant execute on function public.geo_fold(text) to anon, authenticated;
grant execute on function public.geo_cities_search(text, text, text, integer) to anon, authenticated;

-- 2. Shipping addresses --------------------------------------------------------

create table public.os_person_shipping (
  tenant_id uuid not null references public.tenants(id),
  user_id uuid not null references auth.users(id),
  recipient_name text check (recipient_name is null or length(recipient_name) <= 120),
  line1 text check (line1 is null or length(line1) <= 200),
  line2 text check (line2 is null or length(line2) <= 200),
  city text check (city is null or length(city) <= 100),
  region text check (region is null or length(region) <= 100),
  postal_code text check (postal_code is null or length(postal_code) <= 20),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  phone text
    check (phone is null or (length(phone) between 5 and 40 and phone ~ '^\+?[0-9 ().-]+$')),
  notes text check (notes is null or length(notes) <= 300),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

comment on table public.os_person_shipping is
  'Where Virgilio ships a person swag or mail: People & Access admins and the person themself only.';

-- Blanks become null, the person must belong to the workspace, and the row
-- can't move to another person or workspace.
create or replace function public.os_person_shipping_validate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.recipient_name := nullif(btrim(new.recipient_name), '');
  new.line1 := nullif(btrim(new.line1), '');
  new.line2 := nullif(btrim(new.line2), '');
  new.city := nullif(btrim(new.city), '');
  new.region := nullif(btrim(new.region), '');
  new.postal_code := nullif(upper(btrim(new.postal_code)), '');
  new.country_code := nullif(upper(btrim(new.country_code)), '');
  new.phone := nullif(btrim(new.phone), '');
  new.notes := nullif(btrim(new.notes), '');
  if tg_op = 'UPDATE' and (new.tenant_id <> old.tenant_id or new.user_id <> old.user_id) then
    raise exception 'A shipping address can''t move to another person.' using errcode = 'GOS02';
  end if;
  if not exists (select 1 from public.members m where m.tenant_id = new.tenant_id and m.user_id = new.user_id) then
    raise exception 'This person is not a member of the workspace.' using errcode = 'GOS02';
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$function$;

-- External users: People & Access keeps nothing for them (GEX02).
create trigger a0_os_person_shipping_external
  before insert or update on public.os_person_shipping
  for each row execute function public.os_refuse_external();

create trigger os_person_shipping_validate
  before insert or update on public.os_person_shipping
  for each row execute function public.os_person_shipping_validate();

-- History: which fields changed, by whom. No values.
create or replace function public.os_person_shipping_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  changed text[] := '{}';
begin
  if new.recipient_name is distinct from (case when tg_op = 'UPDATE' then old.recipient_name end) then changed := array_append(changed, 'recipient'); end if;
  if new.line1 is distinct from (case when tg_op = 'UPDATE' then old.line1 end)
     or new.line2 is distinct from (case when tg_op = 'UPDATE' then old.line2 end) then changed := array_append(changed, 'street'); end if;
  if new.city is distinct from (case when tg_op = 'UPDATE' then old.city end) then changed := array_append(changed, 'city'); end if;
  if new.region is distinct from (case when tg_op = 'UPDATE' then old.region end) then changed := array_append(changed, 'region'); end if;
  if new.postal_code is distinct from (case when tg_op = 'UPDATE' then old.postal_code end) then changed := array_append(changed, 'postal_code'); end if;
  if new.country_code is distinct from (case when tg_op = 'UPDATE' then old.country_code end) then changed := array_append(changed, 'country'); end if;
  if new.phone is distinct from (case when tg_op = 'UPDATE' then old.phone end) then changed := array_append(changed, 'phone'); end if;
  if new.notes is distinct from (case when tg_op = 'UPDATE' then old.notes end) then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) = 0 then
    return new;
  end if;
  insert into public.os_audit_log (tenant_id, actor_id, subject_user_id, action, detail)
  values (new.tenant_id, auth.uid(), new.user_id, 'person.shipping_updated', jsonb_build_object('fields', to_jsonb(changed)));
  return new;
end;
$function$;

create trigger os_person_shipping_audit
  after insert or update on public.os_person_shipping
  for each row execute function public.os_person_shipping_audit();

alter table public.os_person_shipping enable row level security;

create policy os_person_shipping_read on public.os_person_shipping
  for select to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_shipping_insert on public.os_person_shipping
  for insert to authenticated
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());
create policy os_person_shipping_update on public.os_person_shipping
  for update to authenticated
  using (public.is_os_admin(tenant_id) or user_id = auth.uid())
  with check (public.is_os_admin(tenant_id) or user_id = auth.uid());

revoke all on public.os_person_shipping from anon, authenticated;
grant select, insert, update on public.os_person_shipping to authenticated;
