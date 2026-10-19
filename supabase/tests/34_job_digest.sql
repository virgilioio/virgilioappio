-- Run after 20261019055509_job_digest inside a transaction that is rolled back.
-- A fake open job with Allan on its team gets two fake applications; the digest
-- is written once, claimed for email and finished. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  org uuid := (select organization_id from public.jobs where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
                group by 1 order by count(*) desc limit 1);
  today date := (now() at time zone 'America/Mexico_City')::date;
  job uuid; quiet uuid; c1 uuid; c2 uuid; n int; r record; d jsonb; t timestamptz;
begin
  -- The 9:00 email: an unset (UTC) zone reads as Mexico City.
  t := public.next_morning_nine('allan@virgilio.tech');
  insert into t_results values ('Gio''s rejection email is at 9:00 in the sender''s zone, Mexico City when unset',
    extract(minute from t) = 0 and t > now() and t < now() + interval '34 hours'
    and (extract(hour from t at time zone coalesce(
          (select nullif(nullif(timezone, ''), 'UTC') from public.profiles where user_id = allan), 'America/Mexico_City')) = 9));

  insert into public.jobs (title, organization_id, tenant_id, location, status, created_by)
  values ('TEST digest job', org, ten, 'Guadalajara', 'open', allan) returning id into job;
  insert into public.jobs (title, organization_id, tenant_id, location, status, created_by)
  values ('TEST quiet job', org, ten, 'Guadalajara', 'open', allan) returning id into quiet;
  insert into public.job_assignments (job_id, user_id, organization_id, assigned_by, role)
  select x, allan, org, allan, 'recruiter' from unnest(array[job, quiet]) x
   where not exists (select 1 from public.job_assignments where job_id = x and user_id = allan);

  insert into public.candidates (candidate_name, email, tenant_id, organization_id)
  values ('TEST Digest One', 'test.digest1@example.com', ten, ten) returning id into c1;
  insert into public.candidates (candidate_name, email, tenant_id, organization_id)
  values ('TEST Digest Two', 'test.digest2@example.com', ten, ten) returning id into c2;
  insert into public.job_candidate_associations (job_id, candidate_id, status, applied_at)
  values (job, c1, 'active', now() - interval '2 hours'), (job, c2, 'active', now() - interval '1 hour');

  -- Allan's own digest for today is written fresh for the test.
  update public.job_digests set day = day - 400 where user_id = allan and day = today;

  perform public.job_digest_prepare();
  select * into r from public.job_digests where user_id = allan and day = today;
  insert into t_results values ('the team member gets today''s digest', found);
  select j into d from jsonb_array_elements(r.content->'jobs') j where j->>'job_id' = job::text;
  insert into t_results values ('it counts the job''s applications and names the latest first',
    (d->>'apps')::int = 2 and d->'names'->>0 = 'TEST Digest Two' and d->'names'->>1 = 'TEST Digest One');
  insert into t_results values ('a job with nothing to say is left out',
    not exists (select 1 from jsonb_array_elements(r.content->'jobs') j where j->>'job_id' = quiet::text));
  insert into t_results values ('email follows the person''s own preference',
    r.wants_email = coalesce((select daily_digest_email from public.notification_preferences where user_id = allan), false));

  select count(*) into n from public.job_digests where user_id = allan and day = today;
  perform public.job_digest_prepare();
  insert into t_results values ('once a day: a second run writes nothing new',
    n = 1 and (select count(*) from public.job_digests where user_id = allan and day = today) = 1);

  update public.job_settings set daily_digest = false where job_id = job;
  update public.job_digests set day = day - 401 where user_id = allan and day = today;
  perform public.job_digest_prepare();
  select * into r from public.job_digests where user_id = allan and day = today;
  insert into t_results values ('a job with the digest off is never in it',
    not found or not exists (select 1 from jsonb_array_elements(r.content->'jobs') j where j->>'job_id' = job::text));
  update public.job_settings set daily_digest = true where job_id = job;

  -- The email queue.
  update public.job_digests set day = day - 402 where user_id = allan and day = today;
  perform public.job_digest_prepare();
  update public.job_digests set wants_email = true where user_id = allan and day = today;
  select count(*) into n from public.job_digest_claim(500) c where c.user_id = allan and c.day = today and c.email is not null;
  insert into t_results values ('a digest owed by email is claimed with the address', n = 1);
  select count(*) into n from public.job_digest_claim(500) c where c.user_id = allan and c.day = today;
  insert into t_results values ('a claimed digest isn''t claimed twice', n = 0);
  perform public.job_digest_finish(allan, today, true);
  insert into t_results values ('a sent digest is marked sent',
    (select emailed_at is not null and error is null from public.job_digests where user_id = allan and day = today));

  insert into t_results values ('the schedule runs from 9:00 Mexico City',
    exists (select 1 from cron.job where jobname = 'job-daily-digest' and schedule = '*/15 15-17 * * *'));
  insert into t_results values ('nobody but the server reads digests',
    not has_table_privilege('authenticated', 'public.job_digests', 'select')
    or not exists (select 1 from pg_policies where tablename = 'job_digests'));
end $$;

select * from t_results;
