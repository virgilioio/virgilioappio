-- Job-board feeds as files (2026-11-27).
--
-- Supabase serves Edge Function responses on *.supabase.co as text/plain, so
-- Talent.com couldn't read generate-talent-feed as XML. Every feed is now also
-- written by that function to the public bucket job-feeds, at
-- {board}/{tenant_id}.xml, which Storage serves as application/xml. Only the
-- function writes there (service role), so the bucket has no storage policies:
-- a public bucket is read through its public address without one.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-feeds', 'job-feeds', true, 20971520, array['application/xml', 'text/xml'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- What Settings › Job boards shows as the XML feed address.
update public.job_board_integrations
   set feed_url = 'https://etrxjxstjfcozdjumfsj.supabase.co/storage/v1/object/public/job-feeds/'
                  || board_name || '/' || lower(tenant_id::text) || '.xml',
       updated_at = now()
 where feed_url like 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-talent-feed%';

-- Rewrite every enabled board's file once an hour.
select cron.schedule(
  'job-feeds-refresh',
  '23 * * * *',
  $cmd$
  select net.http_post(
    url := 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-talent-feed',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'internal_function_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id
  where exists (select 1 from public.job_board_integrations where is_enabled)
  $cmd$
);
