-- Lock seven maintenance functions to the server (2026-10-14, Allan approved).
-- Each is SECURITY DEFINER with no permission check of its own, and anon and
-- authenticated could execute them with the app's publishable key:
--   reassign_candidates_for_stage(uuid)  moves candidates out of a library
--     stage on every job and removes it from their hiring plans
--   consolidate_coresignal_usage(uuid)    keeps one credit-usage row, drops the rest
--   chat_hard_delete_threads(), chat_retention_sweep(),
--   cleanup_expired_draft_conversations(), cleanup_expired_salary_data(),
--   nightly_storage_cleanup()             retention clean-ups
-- Their callers keep access: the stage-retire functions and the stage
-- deactivation trigger run as the owner, pg_cron runs as postgres, and the
-- chat-retention-sweeper edge function uses the service role.

revoke all on function public.reassign_candidates_for_stage(uuid) from public, anon, authenticated;
revoke all on function public.consolidate_coresignal_usage(uuid) from public, anon, authenticated;
revoke all on function public.chat_hard_delete_threads() from public, anon, authenticated;
revoke all on function public.chat_retention_sweep() from public, anon, authenticated;
revoke all on function public.cleanup_expired_draft_conversations() from public, anon, authenticated;
revoke all on function public.cleanup_expired_salary_data() from public, anon, authenticated;
revoke all on function public.nightly_storage_cleanup() from public, anon, authenticated;

grant execute on function public.reassign_candidates_for_stage(uuid) to service_role;
grant execute on function public.consolidate_coresignal_usage(uuid) to service_role;
grant execute on function public.chat_hard_delete_threads() to service_role;
grant execute on function public.chat_retention_sweep() to service_role;
grant execute on function public.cleanup_expired_draft_conversations() to service_role;
grant execute on function public.cleanup_expired_salary_data() to service_role;
grant execute on function public.nightly_storage_cleanup() to service_role;
