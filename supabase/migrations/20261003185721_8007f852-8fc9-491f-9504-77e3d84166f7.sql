REVOKE EXECUTE ON FUNCTION public.job_openings_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_openings_before_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_openings_after_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_job_target_fill_date(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_opening_active_offer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.job_opening_active_offer(uuid) TO authenticated;