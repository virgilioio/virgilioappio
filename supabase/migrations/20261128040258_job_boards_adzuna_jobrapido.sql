-- Virgilio's feed for Adzuna and Jobrapido (2026-11-28, Allan: free boards only).
-- Both take a free XML feed of organic jobs; their files are
-- app.gogio.io/feeds/adzuna/… and /feeds/jobrapido/… (STATIC_FEEDS in
-- src/lib/jobFeedFiles.ts). generate-talent-feed answers 403 for a board that
-- is switched off, so these two are switched on for Virgilio's workspace.

update public.job_board_integrations
   set is_enabled = true,
       updated_at = now()
 where tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab'
   and board_name in ('adzuna', 'jobrapido')
   and not is_enabled;
