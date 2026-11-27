-- Rolled-back test for 20261127235448_job_feed_files (run after it in one
-- transaction). The last statement raises with the results, so nothing is kept.

do $t$
declare
  r text := '';
  b record;
  old_urls int;
begin
  select public, allowed_mime_types, file_size_limit into b from storage.buckets where id = 'job-feeds';
  r := r || 'bucket_public=' || coalesce(b.public::text, 'missing')                                -- true
         || ' types=' || coalesce(array_to_string(b.allowed_mime_types, '|'), 'none')              -- application/xml|text/xml
         || ' limit=' || coalesce(b.file_size_limit::text, 'none');                                -- 20971520

  -- No storage policy lets anyone but the service role write there.
  r := r || ' write_policies=' || (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%job-feeds%')::text;             -- 0

  -- Settings shows the file's address, never the function's.
  select count(*) into old_urls from public.job_board_integrations
   where feed_url like '%/functions/v1/generate-talent-feed%';
  r := r || ' function_urls_left=' || old_urls::text                                               -- 0
         || ' file_urls=' || (select count(*) from public.job_board_integrations
              where feed_url ~ '^https://etrxjxstjfcozdjumfsj\.supabase\.co/storage/v1/object/public/job-feeds/[a-z]+/[0-9a-f-]{36}\.xml$')::text;

  -- The hourly refresh.
  r := r || ' cron=' || coalesce((select schedule from cron.job where jobname = 'job-feeds-refresh'), 'missing')  -- 23 * * * *
         || ' cron_posts=' || coalesce((select (command like '%generate-talent-feed%' and command like '%x-internal-secret%')::text
              from cron.job where jobname = 'job-feeds-refresh'), 'missing');                      -- true

  raise exception 'RESULT %', r;
end $t$;
