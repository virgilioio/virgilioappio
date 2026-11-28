-- Undoes 20261127235448_job_feed_files (2026-11-28). Supabase's gateway serves
-- Storage files on *.supabase.co as text/plain too, so the feed files didn't
-- give Talent.com application/xml. The hourly refresh stops and Settings shows
-- the function's address again. The bucket job-feeds and its seven files stay
-- (removing them needs a desktop apply); nothing reads or writes them.

select cron.unschedule('job-feeds-refresh')
 where exists (select 1 from cron.job where jobname = 'job-feeds-refresh');

update public.job_board_integrations
   set feed_url = 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-talent-feed?tenant_id=' || tenant_id::text,
       updated_at = now()
 where feed_url like 'https://etrxjxstjfcozdjumfsj.supabase.co/storage/v1/object/public/job-feeds/%';
