-- Job IDs: every job has one in the VG-XXXX shape, unique; a new job gets its
-- own whatever the insert says; nobody changes one; the backfill was no edit.
-- Runs inside a block that ends by raising its result, so nothing is kept.
do $t$
declare
  n int;
  j record;
  new_id uuid;
  code text;
  r text := '';
begin
  select count(*) into n from public.jobs where job_code is null;
  r := 'every_job_has_one=' || (n = 0);
  select count(*) into n from public.jobs where job_code !~ '^VG-[2-9A-HJKMNP-Z]{4}$';
  r := r || ' all_in_shape=' || (n = 0);
  select count(*) - count(distinct job_code) into n from public.jobs;
  r := r || ' all_different=' || (n = 0);
  r := r || ' no_look_alikes=' || (not exists (select 1 from public.jobs where substr(job_code, 4) ~ '[01ILO]'));
  select count(*) into n from pg_trigger
   where tgrelid = 'public.jobs'::regclass and not tgisinternal and tgenabled <> 'O';
  r := r || ' triggers_back_on=' || (n = 0);

  -- A new job gets its own ID, even when the insert names one.
  select * into j from public.jobs order by created_at desc limit 1;
  select job_code into code from public.jobs where id = j.id;
  insert into public.jobs (title, tenant_id, organization_id, status, currency, created_by, job_code)
  values ('Job ID test', j.tenant_id, j.organization_id, 'draft', 'USD', j.created_by, code)
  returning id into new_id;
  select job_code into code from public.jobs where id = new_id;
  r := r || ' new_job_gets_one=' || (code ~ '^VG-[2-9A-HJKMNP-Z]{4}$');
  r := r || ' copied_id_not_kept=' || (code <> (select job_code from public.jobs where id = j.id));

  -- Nobody changes one.
  begin
    update public.jobs set job_code = 'VG-2222' where id = new_id;
    r := r || ' cant_change=false';
  exception when others then
    r := r || ' cant_change=' || (sqlstate = 'GJB01');
  end;
  -- Other edits still work and keep it.
  update public.jobs set title = 'Job ID test renamed' where id = new_id;
  r := r || ' other_edits_keep_it=' || ((select job_code from public.jobs where id = new_id) = code);

  -- The shape is enforced.
  r := r || ' shape_checked=' || exists (select 1 from pg_constraint where conname = 'jobs_job_code_format');

  raise exception 'RESULT %', r;
end $t$;
