-- Time to fill counts from when an opening started (Allan, 2026-10-26).
--
-- os_person_performance measured each credited hire from the opening's
-- created_at to its filled_at. The openings that existed before openings
-- were introduced were all created at once on 2026-10-03, after most of them
-- were filled, so every hire so far read as a negative time to fill.
--
-- job_openings.opened_at is when an opening started counting:
--   * the 133 openings made on 2026-10-03 start when their job was created
--     (the best history there is: nothing recorded when a job left draft);
--   * a new opening starts when it's created, or, while its job is still a
--     draft, when the job first leaves draft;
--   * nobody sets it from the browser.
-- The median leaves out a hire that has no start yet or that was filled
-- before its start, so it is never negative.

alter table public.job_openings add column opened_at timestamptz;

comment on column public.job_openings.opened_at is
  'When this opening started counting for time to fill: created, or when its job first left draft. Set by the database.';

-- The openings made all at once when openings were introduced.
update public.job_openings o
set opened_at = j.created_at
from public.jobs j
where j.id = o.job_id
  and o.opened_at is null
  and o.created_at = '2026-10-03 18:56:47.678716+00';

-- Openings made since: when they were created, unless the job is still a draft.
update public.job_openings o
set opened_at = o.created_at
from public.jobs j
where j.id = o.job_id
  and o.opened_at is null
  and j.status::text <> 'draft';

-- A new opening starts now, or when its draft job first opens; the value is
-- the database's, so a browser can't move it.
-- security invoker, so current_user is who is writing (the browser is
-- 'authenticated'); the database's own updates come through the jobs trigger.
create or replace function public.job_openings_opened_at()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    new.opened_at := case
      when (select j.status::text from public.jobs j where j.id = new.job_id) = 'draft' then null
      else now()
    end;
  elsif current_user in ('authenticated', 'anon') and pg_trigger_depth() = 1 then
    new.opened_at := old.opened_at;
  end if;
  return new;
end;
$function$;

create trigger a0_job_openings_opened_at
  before insert or update of opened_at on public.job_openings
  for each row execute function public.job_openings_opened_at();

create or replace function public.jobs_z_openings_opened()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if old.status::text = 'draft' and new.status::text <> 'draft' then
    update public.job_openings set opened_at = now()
    where job_id = new.id and opened_at is null;
  end if;
  return null;
end;
$function$;

create trigger jobs_z_openings_opened
  after update of status on public.jobs
  for each row execute function public.jobs_z_openings_opened();

-- The performance read, now from opened_at. Everything else is as before.
create or replace function public.os_person_performance(_tenant_id uuid, _user_id uuid, _from timestamptz, _to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  me uuid := auth.uid();
  result jsonb;
begin
  if me is null then
    raise exception 'Sign in to do this.' using errcode = 'GPF01';
  end if;
  if not (public.is_os_admin(_tenant_id) or (me = _user_id and exists (
      select 1 from public.members m where m.tenant_id = _tenant_id and m.user_id = me and m.user_status = 'active'))) then
    raise exception 'Only admins and the person themself can see their performance.' using errcode = 'GPF01';
  end if;
  if _from is null or _to is null or _to <= _from then
    raise exception 'Choose a period that ends after it starts.' using errcode = 'GPF02';
  end if;

  with
  hires as (
    select o.id, o.job_id, o.opened_at, o.filled_at,
           o.sourcer_user_id = _user_id as as_sourcer,
           o.recruiter_user_id = _user_id as as_recruiter
    from public.job_openings o
    where o.tenant_id = _tenant_id and o.cancelled_at is null
      and o.filled_at >= _from and o.filled_at < _to
      and (o.sourcer_user_id = _user_id or o.recruiter_user_id = _user_id)
  ),
  added as (
    select a.id, a.job_id, a.candidate_id, a.offered_at, a.hired_at
    from public.job_candidate_associations a
    join public.jobs j on j.id = a.job_id and j.tenant_id = _tenant_id
    where a.added_by = _user_id and a.created_at >= _from and a.created_at < _to
  ),
  interviews as (
    select x.id, nullif(x.metadata->>'job_id', '')::uuid as job_id
    from public.activities x
    where x.tenant_id = _tenant_id and x.user_id = _user_id and x.activity_type = 'interview_scheduled'
      and x.created_at >= _from and x.created_at < _to
  ),
  offers as (
    select a.id, a.job_id
    from public.job_candidate_associations a
    join public.jobs j on j.id = a.job_id and j.tenant_id = _tenant_id
    where a.offered_by = _user_id and a.offered_at >= _from and a.offered_at < _to
  ),
  reached as (
    select a.id,
      (a.offered_at is not null or a.hired_at is not null
        or exists (
          select 1 from public.job_candidate_stage_history h
          join public.job_hiring_stages hs on hs.id = h.to_stage_id
          join public.job_stages s on s.id = hs.stage_id
          where h.association_id = a.id and s.stage_type::text in ('interview', 'offer', 'reference_check'))
        or exists (
          select 1 from public.activities x
          where x.tenant_id = _tenant_id and x.activity_type = 'interview_scheduled'
            and x.metadata->>'candidate_id' = a.candidate_id::text
            and x.metadata->>'job_id' = a.job_id::text)) as interviewed,
      a.offered_at is not null or a.hired_at is not null as offered,
      a.hired_at is not null as hired
    from added a
  ),
  uncredited as (
    select o.id
    from public.job_openings o
    where o.tenant_id = _tenant_id and o.cancelled_at is null
      and o.filled_at >= _from and o.filled_at < _to
      and o.sourcer_user_id is null and o.recruiter_user_id is null
      and exists (
        select 1 from public.job_assignments ja
        where ja.job_id = o.job_id and ja.user_id = _user_id and ja.deleted_at is null
          and ja.role::text in ('recruiter', 'sourcer'))
  ),
  per_job as (
    select job_id,
      count(*) filter (where k = 'added') as added,
      count(*) filter (where k = 'interview') as interviews,
      count(*) filter (where k = 'offer') as offers,
      count(*) filter (where k = 'hire') as hires
    from (
      select job_id, 'added' as k from added
      union all select job_id, 'interview' from interviews where job_id is not null
      union all select job_id, 'offer' from offers
      union all select job_id, 'hire' from hires
    ) e
    group by job_id
  )
  select jsonb_build_object(
    'hires', (select count(*) from hires),
    'hires_as_sourcer', (select count(*) from hires where as_sourcer),
    'hires_as_recruiter', (select count(*) from hires where as_recruiter),
    'fill_days_median', (
      select round((percentile_cont(0.5) within group (order by extract(epoch from (filled_at - opened_at)) / 86400))::numeric, 1)
      from hires where opened_at is not null and filled_at >= opened_at),
    'added', (select count(*) from added),
    'interviews', (select count(*) from interviews),
    'offers', (select count(*) from offers),
    'funnel', jsonb_build_object(
      'added', (select count(*) from reached),
      'interviewed', (select count(*) from reached where interviewed),
      'offered', (select count(*) from reached where offered),
      'hired', (select count(*) from reached where hired)),
    'uncredited_fills', (select count(*) from uncredited),
    'by_job', coalesce((
      select jsonb_agg(jsonb_build_object(
        'job_id', p.job_id, 'title', j.title, 'client', org.name, 'status', j.status,
        'added', p.added, 'interviews', p.interviews, 'offers', p.offers, 'hires', p.hires)
        order by p.hires desc, p.offers desc, p.interviews desc, p.added desc, j.title)
      from (select * from per_job order by hires desc, offers desc, interviews desc, added desc limit 100) p
      join public.jobs j on j.id = p.job_id and j.tenant_id = _tenant_id
      left join public.organizations org on org.id = j.organization_id), '[]'::jsonb)
  ) into result;

  return result;
end;
$function$;
