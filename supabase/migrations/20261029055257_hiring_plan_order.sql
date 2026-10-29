-- A job's hiring plan keeps its default stages first, in priority order
-- (Application Review, then Final Candidate Review), with every other stage
-- after them in the order the team chose.
--
-- 1. New jobs: handle_new_job_defaults numbered the default stages by their
--    id instead of their priority, so some jobs started with Final Candidate
--    Review before Application Review. backfill_default_stages_to_all_jobs
--    had the same slip.
-- 2. job_plan_order(job, ids) writes a plan's order in one step, putting the
--    defaults first whatever it's asked; the editor saves through it, so a
--    save that stops halfway can no longer leave stages in temporary slots.
-- 3. Every plan whose order or numbering is off is put right: defaults first
--    by priority, the rest in their current order, numbered 1..n. Candidates
--    stay in the stages they're in (they point at the stage, not its slot).

create or replace function public.handle_new_job_defaults()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  with defaults as (
    select id as stage_id, coalesce(stage_priority, 500) as pri, created_at
    from public.job_stages
    where is_active = true and is_default = true
  ),
  numbered as (
    select stage_id, row_number() over (order by pri asc, created_at asc, stage_id asc) as rn
    from defaults
  )
  insert into public.job_hiring_stages (job_id, stage_id, position, created_by)
  select new.id, n.stage_id, n.rn, auth.uid()
  from numbered n;

  return new;
end;
$function$;

create or replace function public.backfill_default_stages_to_all_jobs()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  added integer := 0;
begin
  with defaults as (
    select id as stage_id, coalesce(stage_priority, 500) as pri, created_at
    from public.job_stages
    where is_active = true and is_default = true
  ),
  jobs_list as (
    select id as job_id from public.jobs
  ),
  missing as (
    select j.job_id, d.stage_id, d.pri, d.created_at
    from jobs_list j
    cross join defaults d
    left join public.job_hiring_stages x
      on x.job_id = j.job_id and x.stage_id = d.stage_id
    where x.id is null
  ),
  numbered as (
    select job_id, stage_id,
           row_number() over (partition by job_id order by pri asc, created_at asc, stage_id asc) as rn
    from missing
  ),
  base_pos as (
    select job_id, coalesce(max(position), 0) as base
    from public.job_hiring_stages
    group by job_id
  ),
  ins as (
    insert into public.job_hiring_stages (job_id, stage_id, position, created_by)
    select n.job_id, n.stage_id, coalesce(b.base, 0) + n.rn, auth.uid()
    from numbered n
    left join base_pos b on b.job_id = n.job_id
    returning 1
  )
  select count(*) into added from ins;

  -- New defaults land at the end; put them in their place.
  perform public.job_plan_apply(j.id) from public.jobs j;

  return added;
end;
$function$;

-- The order a plan should have: each default stage's first row, by priority
-- (priority 99 or more goes last), then everything else in the order asked
-- (_ids), or the current order when _ids is null.
create or replace function public.job_plan_ranked(_job uuid, _ids uuid[] default null)
returns table (id uuid, rn integer)
language sql
stable
set search_path = public
as $$
  with asked as (
    select h.id, h.stage_id, h.position, s.is_default,
           coalesce(s.stage_priority, 500) as pri,
           coalesce(array_position(_ids, h.id), 0) as asked_at,
           row_number() over (order by h.position, h.created_at, h.id) as now_at
    from public.job_hiring_stages h
    join public.job_stages s on s.id = h.stage_id
    where h.job_id = _job
  ),
  marked as (
    select a.*,
           a.is_default and row_number() over (partition by a.stage_id order by
             case when _ids is null then a.now_at else a.asked_at end) = 1 as pinned
    from asked a
  )
  select m.id,
         (row_number() over (order by
            case when m.pinned and m.pri < 99 then 0 when m.pinned then 2 else 1 end,
            case when m.pinned then m.pri else 0 end,
            case when _ids is null then m.now_at else m.asked_at end))::integer as rn
  from marked m
$$;

-- Writes the order in one step: park every row in a negative slot, then flip
-- it to its place. The server's own; callers check who may.
create or replace function public.job_plan_apply(_job uuid, _ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_hiring_stages h set position = -r.rn
  from public.job_plan_ranked(_job, _ids) r
  where h.id = r.id;
  update public.job_hiring_stages h set position = -h.position
  where h.job_id = _job and h.position < 0;
end $$;

-- The editor's save: the job's managers only, every stage of the plan once.
create or replace function public.job_plan_order(_job uuid, _ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_job(_job) then
    raise exception 'Only admins and the job''s Recruiter can change its hiring plan.' using errcode = 'GPL02';
  end if;
  if _ids is not null and (
       (select count(*) from public.job_hiring_stages h where h.job_id = _job) <> cardinality(_ids)
       or (select count(distinct i) from unnest(_ids) i) <> cardinality(_ids)
       or exists (select 1 from unnest(_ids) i
                  where not exists (select 1 from public.job_hiring_stages h where h.id = i and h.job_id = _job))
     ) then
    raise exception 'The hiring plan changed while it was being saved. Reload it and try again.' using errcode = 'GPL01';
  end if;
  perform public.job_plan_apply(_job, _ids);
end $$;

revoke execute on function public.job_plan_ranked(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.job_plan_apply(uuid, uuid[]) from public, anon, authenticated;
revoke execute on function public.job_plan_order(uuid, uuid[]) from public, anon;
grant execute on function public.job_plan_order(uuid, uuid[]) to authenticated;

-- Put every plan that's out of order or oddly numbered right.
do $$
declare
  j uuid;
begin
  for j in
    select distinct h.job_id
    from public.job_hiring_stages h
    join lateral public.job_plan_ranked(h.job_id) r on r.id = h.id
    where h.position <> r.rn
  loop
    perform public.job_plan_apply(j);
  end loop;
end $$;
