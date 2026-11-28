-- Settings › Job boards shows the feed's file on app.gogio.io (2026-11-28).
-- Boards read public/feeds/{board}/{tenant_id}.xml, which app.gogio.io serves
-- as application/xml (scripts/generate-job-feeds.ts, the GitHub job "Job
-- feeds"); the function's own address is served as text/plain by Supabase.

update public.job_board_integrations
   set feed_url = 'https://app.gogio.io/feeds/' || board_name || '/' || lower(tenant_id::text) || '.xml',
       updated_at = now()
 where feed_url like 'https://etrxjxstjfcozdjumfsj.supabase.co/functions/v1/generate-talent-feed%';
