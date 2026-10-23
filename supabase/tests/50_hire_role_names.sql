-- Run after 20261023042119_hire_role_names inside a transaction that is rolled back.
-- The seat label and the publish checks say Sourcer and Recruiter. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

insert into t_results values ('the Recruiter seat is called Recruiter', public.job_seat_role_label('recruiter') = 'Recruiter');
insert into t_results values ('the Sourcer seat is called Sourcer', public.job_seat_role_label('sourcer') = 'Sourcer');
-- A job with Recruiters and no Sourcer (Sales Development Representative, SMB - LATAM).
insert into t_results select 'a job with no Sourcer asks for a Sourcer',
  (c->'missing') ? 'Sourcer' and not (c->'missing') ? 'Sourcing Partner' and not (c->'missing') ? 'Recruiter'
  from (select public.job_setup_checks(job_id) c from public.job_openings where id = 'e7ec217d-35a1-40a9-8d27-40accb655790') x;
insert into t_results select 'no check uses the old names',
  not exists (select 1 from pg_proc where proname in ('job_setup_checks', 'job_seat_role_label')
              and (prosrc like '%TA Partner%' or prosrc like '%Sourcing Partner%'));

select * from t_results;
