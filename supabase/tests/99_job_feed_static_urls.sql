-- Rolled-back test for the job_feed_static_urls migration (run after it in one
-- transaction). The last statement raises with the results, so nothing is kept.

do $t$
declare r text := '';
begin
  r := 'function_urls_left=' || (select count(*) from public.job_board_integrations
         where feed_url like '%/functions/v1/generate-talent-feed%')::text                     -- 0
    || ' file_urls=' || (select count(*) from public.job_board_integrations
         where feed_url ~ '^https://app\.gogio\.io/feeds/[a-z]+/[0-9a-f-]{36}\.xml$')::text      -- 3
    || ' virgilio=' || coalesce((select feed_url from public.job_board_integrations
         where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab' and board_name = 'talent'), 'missing');
  raise exception 'RESULT %', r;
end $t$;
