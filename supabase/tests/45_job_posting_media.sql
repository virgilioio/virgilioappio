-- Run after 20261022232047_job_posting_media inside a transaction that is rolled back.
-- Allan (who can edit jobs) creates a fake job and uploads its cover and video;
-- a member who can't edit it, and a path that isn't a job's folder, are refused.
-- Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  org uuid := (select organization_id from public.jobs where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
                group by 1 order by count(*) desc limit 1);
  stranger uuid;
  job uuid; ok boolean;
begin
  insert into t_results values ('the bucket is public and takes 200 MB MP4s and images',
    (select public and file_size_limit = 209715200
            and 'video/mp4' = any(allowed_mime_types) and 'image/jpeg' = any(allowed_mime_types)
            and not ('application/pdf' = any(allowed_mime_types))
       from storage.buckets where id = 'job-posting-media'));

  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.jobs (title, organization_id, tenant_id, status, created_by)
  values ('TEST posting media', org, ten, 'draft', allan) returning id into job;

  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-posting-media', job::text || '/video-1.mp4', allan);
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('the job''s editor uploads a video into its folder', ok);
  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-posting-media', job::text || '/cover-1.jpg', allan);
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('and a cover image', ok);
  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-posting-media', 'covers/loose.jpg', allan);
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('a file outside a job''s folder is refused', ok);
  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-posting-media', gen_random_uuid()::text || '/video-1.mp4', allan);
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('a folder that isn''t a job is refused', ok);

  execute 'reset role';
  -- The first active member who can't edit the fake job (no seat, no recruiter rights over its client).
  for stranger in
    select m.user_id from public.members m
    where m.tenant_id = ten and m.user_status = 'active' and m.user_id <> allan
    order by m.created_at
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
    exit when not public.can_edit_job(job);
  end loop;
  execute 'set local role authenticated';
  insert into t_results values ('the stranger can''t edit the fake job', not public.can_edit_job(job));
  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-posting-media', job::text || '/video-2.mp4', stranger);
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('someone who can''t edit the job can''t upload to it', ok);
  execute 'reset role';
end $$;

select * from t_results;
