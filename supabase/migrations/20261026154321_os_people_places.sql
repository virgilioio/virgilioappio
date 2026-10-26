-- Where people live, by city (Allan, 2026-10-26).
--
-- The People & Access dashboard's map gets city pins: geo_cities gains the
-- coordinates GeoNames already publishes (filled by geo-load, run again), and
-- os_people_dashboard returns `places`, each city with its coordinates and the
-- people who live there. Everything else the dashboard returns is unchanged,
-- and it is still People & Access admins only (GPD01).

alter table public.geo_cities add column latitude double precision;
alter table public.geo_cities add column longitude double precision;

comment on column public.geo_cities.latitude is 'GeoNames latitude, for the People & Access map.';
comment on column public.geo_cities.longitude is 'GeoNames longitude, for the People & Access map.';

create or replace function public.os_people_dashboard(_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'invited', (select count(*) from public.members m where m.tenant_id = _tenant_id and m.user_status = 'invited'
      and m.user_type::text <> 'external'),
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
    -- Where people live, city by city, placed on the map from geo_cities: the
    -- city of that name in their country, in their state when it says which,
    -- otherwise the biggest. A city that isn't listed, or no city, comes back
    -- without coordinates and the map counts it under its country.
    'places', coalesce((select jsonb_agg(jsonb_build_object(
        'country_code', pl.country_code, 'city', pl.city, 'region', pl.region,
        'lat', pl.lat, 'lng', pl.lng, 'people', pl.people) order by pl.country_code, jsonb_array_length(pl.people) desc, pl.city nulls last)
      from (
        select m.country_code,
          min(d.city) as city,
          min(d.region) as region,
          min(g.latitude) as lat,
          min(g.longitude) as lng,
          jsonb_agg(jsonb_build_object('user_id', m.user_id, 'member_id', m.member_id, 'name', m.name, 'avatar_url', m.avatar_url)
            order by m.name) as people
        from marked m
        left join public.os_person_details d on d.tenant_id = _tenant_id and d.user_id = m.user_id
        left join lateral (
          select gc.latitude, gc.longitude
          from public.geo_cities gc
          left join public.geo_regions gr on gr.country_code = gc.country_code and gr.code = gc.region_code
          where d.city is not null and gc.country_code = m.country_code and gc.search_name = public.geo_fold(d.city)
          order by (d.region is not null and public.geo_fold(gr.name) = public.geo_fold(d.region)) desc, gc.population desc
          limit 1
        ) g on true
        where m.country_code is not null
        group by m.country_code, public.geo_fold(d.city), public.geo_fold(d.region)
      ) pl), '[]'::jsonb),
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
