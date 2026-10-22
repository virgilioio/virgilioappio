-- One person, one role on a job (Allan, 2026-10-22).
--
-- job_assignments was unique per (job, person, role), so the same person could
-- be a job's TA Partner, hiring manager and sourcer at once; the team screens
-- allowed it in four places. Now:
-- 1. a person holds at most one live seat per job (a removed seat, deleted_at
--    set, doesn't count); no live data breaks this today;
-- 2. a second seat is refused with a message the screens show as it is
--    (SQLSTATE GJT01): "Maya Okafor is already on this job as Hiring manager.";
-- 3. a seat written without a role is an interviewer, the least access, not a
--    TA Partner (the Members page added people to jobs this way, which gave
--    them the talent pool).
-- Several TA Partners or hiring managers on a job stay possible, as different
-- people. Coordinator and Reports to are fields on the job, not seats.

create unique index if not exists job_assignments_one_seat_per_person
  on public.job_assignments (job_id, user_id)
  where deleted_at is null;

create or replace function public.job_seat_role_label(_role public.job_assignment_role)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case _role::text
    when 'recruiter' then 'TA Partner'
    when 'sourcer' then 'Sourcer'
    when 'hiring_manager' then 'Hiring manager'
    when 'interviewer' then 'Interviewer'
    else initcap(replace(_role::text, '_', ' '))
  end;
$function$;

create or replace function public.job_assignments_one_seat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _other public.job_assignment_role;
  _who text;
begin
  if new.deleted_at is not null then
    return new;
  end if;
  select ja.role into _other
  from public.job_assignments ja
  where ja.job_id = new.job_id
    and ja.user_id = new.user_id
    and ja.deleted_at is null
    and ja.id is distinct from new.id
  limit 1;
  if found then
    select coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), p.email)
      into _who
    from public.profiles p
    where p.user_id = new.user_id;
    raise exception '% is already on this job as %.', coalesce(_who, 'This person'), public.job_seat_role_label(_other)
      using errcode = 'GJT01',
            hint = 'Change their role instead of adding them again.';
  end if;
  return new;
end;
$function$;

create trigger job_assignments_a_one_seat
  before insert or update of job_id, user_id, deleted_at on public.job_assignments
  for each row execute function public.job_assignments_one_seat();

alter table public.job_assignments alter column role set default 'interviewer'::public.job_assignment_role;
