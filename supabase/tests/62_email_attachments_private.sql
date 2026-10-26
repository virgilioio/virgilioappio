-- Run after 20261026040715_email_attachments_private inside a transaction that is rolled back.
-- No policy lets a signed-in user reach email-attachments any more, the public
-- buckets keep theirs, and the bucket stays private. Every row's ok is true.
create temp table t_results (check_name text, ok boolean);

do $$
declare
  n int;
begin
  insert into t_results values ('the open read policy is gone',
    not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated users can read email attachments'));
  insert into t_results values ('the open upload policy is gone',
    not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Service role can upload email attachments'));

  select count(*) into n from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual, '') ilike '%email-attachments%' or coalesce(with_check, '') ilike '%email-attachments%');
  insert into t_results values ('no policy reaches email-attachments', n = 0);

  insert into t_results values ('the bucket stays private',
    exists (select 1 from storage.buckets where id = 'email-attachments' and not public));

  select count(*) into n from pg_policies
  where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
    and policyname in ('Anyone can view assets', 'Anyone can view avatars',
                       'Public can view careers logos', 'Anyone can view dashboard photos');
  insert into t_results values ('the public buckets keep their read policies', n = 4);
end $$;

do $$
declare
  r text;
begin
  select string_agg(case when ok then 'ok   ' else 'FAIL ' end || check_name, E'\n') into r from t_results;
  raise exception 'RESULTS%', E'\n' || r;
end $$;
