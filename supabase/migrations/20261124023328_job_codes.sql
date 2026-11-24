-- Job IDs (Allan, Go! 2026-11-24): every job has one, VG- and four letters or
-- numbers (VG-7K3P), shown under the job's title, next to it in the Jobs list,
-- found by search, and sent to Gio Sales with the deal's job. Like Req IDs on
-- openings: the database assigns it when the job is made, it never changes,
-- and it's unique across every workspace. The four characters leave out the
-- ones that read alike (0 and O, 1, I and L): 31 to choose from, about 920,000 IDs.

create or replace function public.job_code_new()
returns text
language plpgsql
volatile
set search_path to 'public'
as $function$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  code text;
  tries int := 0;
begin
  loop
    code := 'VG-';
    for i in 1..4 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.jobs j where j.job_code = code);
    tries := tries + 1;
    if tries > 50 then
      raise exception 'Couldn''t find a free Job ID.' using errcode = 'GJB02';
    end if;
  end loop;
  return code;
end;
$function$;

revoke all on function public.job_code_new() from public, anon, authenticated;

alter table public.jobs add column job_code text;

-- Every job there is gets one, open, draft, closed or removed, oldest first.
-- The table's own triggers stay out of it: a new ID is not an edit (no
-- updated_at, no re-score, no message to Slack or Gio Sales).
alter table public.jobs disable trigger user;
do $backfill$
declare r record;
begin
  for r in select id from public.jobs where job_code is null order by created_at, id loop
    update public.jobs set job_code = public.job_code_new() where id = r.id;
  end loop;
end
$backfill$;
alter table public.jobs enable trigger user;

alter table public.jobs alter column job_code set not null;
alter table public.jobs add constraint jobs_job_code_format check (job_code ~ '^VG-[2-9A-HJKMNP-Z]{4}$');
create unique index jobs_job_code_key on public.jobs (job_code);

comment on column public.jobs.job_code is
  'The job''s ID (VG-XXXX): assigned by the database when the job is made, never changed, unique everywhere.';

-- New jobs get theirs from the database whatever the insert says (a copied
-- job never keeps its source's); afterwards it never changes.
create or replace function public.jobs_job_code()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    new.job_code := public.job_code_new();
  elsif new.job_code is distinct from old.job_code then
    raise exception 'Job IDs are assigned automatically and cannot be changed.' using errcode = 'GJB01';
  end if;
  return new;
end;
$function$;

create trigger a0_jobs_job_code
  before insert or update of job_code on public.jobs
  for each row execute function public.jobs_job_code();
