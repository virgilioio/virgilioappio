revoke execute on function public.jobs_protect_sales_team() from public, anon, authenticated;
revoke execute on function public.jobs_publish_gate() from public, anon, authenticated;
revoke execute on function public.job_assignments_sales_team_event() from public, anon, authenticated;
revoke execute on function public.ats_person(uuid) from public, anon, authenticated;
grant execute on function public.ats_person(uuid) to service_role;