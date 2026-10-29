-- Run after 20261029044938_posting_old_links inside a transaction that is rolled back.
-- Old posting links lead to the new address; bell items about a candidate in
-- a job open the in-job profile.
--   Allan Bravo  admin, renames two live postings on open jobs (live data)
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant all on t_results to authenticated, anon;

create or replace function pg_temp.err_of(_sql text)
returns text
language plpgsql
as $$
begin
  execute _sql;
  return 'none';
exception when others then
  return sqlstate;
end $$;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  p1 uuid;
  p2 uuid;
  j1 uuid;
  first_slug text;
  cand uuid;
  cjob uuid;
  url text;
begin
  select p.id, p.slug, p.job_id into p1, first_slug, j1
  from public.job_postings p join public.jobs j on j.id = p.job_id
  where p.is_active and j.status = 'open' and p.tenant_id = ten
  order by p.created_at limit 1;
  select p.id into p2
  from public.job_postings p join public.jobs j on j.id = p.job_id
  where p.is_active and j.status = 'open' and p.tenant_id = ten and p.id <> p1
  order by p.created_at limit 1;

  -- Allan renames it twice through the app's rules.
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  update public.job_postings set slug = 'zz-old-links-second' where id = p1;
  update public.job_postings set slug = 'zz-old-links-third' where id = p1;
  update public.job_postings set title = title where id = p1;
  perform set_config('role', 'postgres', true);

  insert into t_results values ('the first address leads to the current one',
    public.posting_current_slug(first_slug) = 'zz-old-links-third');
  insert into t_results values ('so does the one in between',
    public.posting_current_slug('zz-old-links-second') = 'zz-old-links-third');
  insert into t_results values ('the current address needs no redirect',
    public.posting_current_slug('zz-old-links-third') is null);
  insert into t_results values ('an address never used leads nowhere',
    public.posting_current_slug('zz-old-links-never') is null);
  insert into t_results values ('saving without a new address remembers nothing',
    (select count(*) from public.job_posting_old_slugs where posting_id = p1) = 2);

  -- Visitors can ask, but can't read the list.
  perform set_config('role', 'anon', true);
  insert into t_results values ('a visitor gets the redirect',
    public.posting_current_slug(first_slug) = 'zz-old-links-third');
  insert into t_results values ('a visitor can''t read old addresses',
    pg_temp.err_of('select * from public.job_posting_old_slugs') = '42501');
  perform set_config('role', 'postgres', true);

  -- Another posting takes the old address: it wins.
  update public.job_postings set slug = 'zz-old-links-second' where id = p2;
  insert into t_results values ('a posting that takes an old address wins',
    public.posting_current_slug('zz-old-links-second') is null);
  update public.job_postings set slug = 'zz-old-links-p2' where id = p2;
  insert into t_results values ('and the address is remembered as the newer posting''s',
    public.posting_current_slug('zz-old-links-second') = 'zz-old-links-p2');

  -- A draft or a closed job keeps "not found".
  update public.job_postings set is_active = false where id = p1;
  insert into t_results values ('a draft posting doesn''t redirect',
    public.posting_current_slug(first_slug) is null);
  update public.job_postings set is_active = true where id = p1;
  update public.jobs set status = 'closed' where id = j1;
  insert into t_results values ('a posting on a closed job doesn''t redirect',
    public.posting_current_slug(first_slug) is null);

  insert into t_results values ('the rename record is the server''s',
    not has_function_privilege('authenticated', 'public.job_postings_z_old_slug()', 'execute'));

  -- Bell items.
  select a.candidate_id, a.job_id into cand, cjob from public.job_candidate_associations a
  join public.jobs j on j.id = a.job_id where j.tenant_id = ten limit 1;

  insert into public.notifications (user_id, tenant_id, category, title, job_id, candidate_id, action_url)
  values (allan, ten, 'scorecard_submitted', 't', cjob, cand, '/candidates?openCandidate=' || cand)
  returning action_url into url;
  insert into t_results values ('a scorecard opens its Scorecards tab in the job',
    url = '/jobs/' || cjob || '/candidates/' || cand || '?tab=scorecards');

  insert into public.notifications (user_id, tenant_id, category, title, job_id, candidate_id, action_url)
  values (allan, ten, 'interview_event', 't', cjob, cand, '/candidates?openCandidate=' || cand)
  returning action_url into url;
  insert into t_results values ('an interview opens the in-job profile',
    url = '/jobs/' || cjob || '/candidates/' || cand);

  insert into public.notifications (user_id, tenant_id, category, title, job_id, candidate_id, action_url)
  values (allan, ten, 'candidate_update', 't', cjob, cand, '/candidates/' || cand)
  returning action_url into url;
  insert into t_results values ('a client decision opens the in-job profile',
    url = '/jobs/' || cjob || '/candidates/' || cand);

  insert into public.notifications (user_id, tenant_id, category, title, job_id, candidate_id, action_url)
  values (allan, ten, 'interview_event', 't', null, cand, '/candidates?openCandidate=' || cand)
  returning action_url into url;
  insert into t_results values ('without a job it keeps the general profile',
    url = '/candidates?openCandidate=' || cand);

  insert into public.notifications (user_id, tenant_id, category, title, job_id, candidate_id, action_url)
  values (allan, ten, 'offer_event', 't', cjob, cand, '/jobs/' || cjob || '/candidates/' || cand || '?focus=approval')
  returning action_url into url;
  insert into t_results values ('a link that already names a place is left alone',
    url = '/jobs/' || cjob || '/candidates/' || cand || '?focus=approval');
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n' order by ok, check_name) into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
