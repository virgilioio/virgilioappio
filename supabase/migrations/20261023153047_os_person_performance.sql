-- Member profile, step 4: performance on the Work tab (Allan, 2026-10-23).
--
-- One read-only function that counts a person's work over a period, on the
-- server, so nobody's browser reads other people's pipelines. The person
-- themself and People & Access admins may call it. It changes nothing.
--
--   hires             filled openings that credit them (Sourcer or Recruiter)
--   fill_days_median  median days from opening to fill, for those hires
--   added             candidates they put into a job's pipeline
--   interviews        interviews they scheduled (the activity log)
--   offers            candidates they moved to offer
--   funnel            of the candidates they added in the period: how many
--                     reached an interview, an offer, a hire
--   uncredited_fills  openings filled in the period on jobs where they hold a
--                     Sourcer or Recruiter seat, with no credit on them yet
--   by_job            the same counts per job (up to 100 jobs)
--
-- The period is [from, to). Cancelled openings never count.

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
    select o.id, o.job_id, o.created_at, o.filled_at,
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
  -- Of the candidates they added: did each reach an interview stage (or an
  -- interview, an offer or a hire), an offer, a hire.
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
    'fill_days_median', (select round((percentile_cont(0.5) within group (order by extract(epoch from (filled_at - created_at)) / 86400))::numeric, 1) from hires),
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
revoke all on function public.os_person_performance(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.os_person_performance(uuid, uuid, timestamptz, timestamptz) to authenticated;
