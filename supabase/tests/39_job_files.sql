-- Run after 20261020200003_job_files inside a transaction that is rolled back.
-- Allan (an active member) creates a fake job, adds a file row and its storage
-- object, then an outsider (no active membership) tries the same. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);
grant insert on t_results to authenticated;

do $$
declare
  ten constant uuid := '5ba7b145-f251-4b18-8900-724cb06028ab';
  allan constant uuid := '7acbeead-b1b8-442c-b316-bff9779dc7de';
  outsider constant uuid := '65689677-7b35-448e-9a37-89fb910413be';
  org uuid := (select organization_id from public.jobs where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
                group by 1 order by count(*) desc limit 1);
  job uuid; f uuid; ok boolean; n int; r record;
begin
  insert into t_results values ('the bucket is private and takes 25 MB documents',
    (select not public and file_size_limit = 26214400 and 'application/pdf' = any(allowed_mime_types)
       from storage.buckets where id = 'job-files'));
  insert into t_results values ('job_file_job reads the job from a path, nothing from other shapes',
    public.job_file_job('11111111-2222-3333-4444-555555555555/a.pdf') = '11111111-2222-3333-4444-555555555555'
    and public.job_file_job('templates/a.pdf') is null and public.job_file_job('') is null);

  -- Allan --------------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', allan, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.jobs (title, organization_id, tenant_id, status, created_by)
  values ('TEST job files', org, ten, 'draft', allan) returning id into job;

  insert into public.job_files (job_id, file_name, storage_path, mime_type, size_bytes, extracted_text)
  values (job, 'Intake notes.pdf', job::text || '/abc-Intake notes.pdf', 'application/pdf', 1200, 'Fake intake text.')
  returning id into f;
  select * into r from public.job_files where id = f;
  insert into t_results values ('the editor adds a file and reads it back, signed as the uploader',
    r.id is not null and r.uploaded_by = allan and r.removed_at is null);

  begin
    insert into public.job_files (job_id, file_name, storage_path) values (job, 'x.pdf', gen_random_uuid()::text || '/x.pdf');
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('a file row must sit under its own job''s folder', ok);

  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-files', job::text || '/abc-Intake notes.pdf', allan);
    ok := true;
  exception when others then ok := false; end;
  insert into t_results values ('the editor uploads into the job''s folder', ok);
  insert into t_results values ('the editor reads the job''s files in storage',
    exists (select 1 from storage.objects where bucket_id = 'job-files' and name = job::text || '/abc-Intake notes.pdf'));

  update public.job_files set removed_at = now() where id = f;
  select * into r from public.job_files where id = f;
  insert into t_results values ('taking a file off the job records who and when', r.removed_at is not null and r.removed_by = allan);
  update public.job_files set removed_at = null where id = f;
  insert into t_results values ('a removed file stays removed',
    (select removed_at is not null from public.job_files where id = f));

  begin
    update public.job_files set file_name = 'renamed.pdf' where id = f;
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('nothing else about a file can be changed', ok);
  execute 'reset role';

  -- An outsider ------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', outsider, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.job_files where job_id = job;
  insert into t_results values ('an outsider sees none of the job''s files', n = 0);
  select count(*) into n from storage.objects where bucket_id = 'job-files' and name like job::text || '/%';
  insert into t_results values ('an outsider reads nothing in the job''s folder', n = 0);
  begin
    insert into public.job_files (job_id, file_name, storage_path) values (job, 'y.pdf', job::text || '/y.pdf');
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('an outsider can''t add a file row', ok);
  begin
    insert into storage.objects (bucket_id, name, owner) values ('job-files', job::text || '/y.pdf', outsider);
    ok := false;
  exception when others then ok := true; end;
  insert into t_results values ('an outsider can''t upload into the job''s folder', ok);
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);

  -- Anonymous --------------------------------------------------------------------------
  execute 'set local role anon';
  begin
    select count(*) into n from public.job_files;
    ok := false;
  exception when others then ok := true; end;
  execute 'reset role';
  insert into t_results values ('anonymous visitors can''t read job files', ok);
end $$;

select * from t_results;
