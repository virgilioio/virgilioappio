revoke execute on function public.jobs_track_editor() from public, anon, authenticated;
revoke execute on function public.jobs_protect_sales_draft() from public, anon, authenticated;
revoke execute on function public.jobs_publish_gate() from public, anon, authenticated;
revoke execute on function public.job_setup_checks(uuid) from public, anon;
grant execute on function public.job_setup_checks(uuid) to authenticated, service_role;