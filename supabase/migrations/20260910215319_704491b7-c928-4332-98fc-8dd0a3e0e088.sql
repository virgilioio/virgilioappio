REVOKE EXECUTE ON FUNCTION public.enqueue_stage_automation_runs(uuid, uuid, public.automation_trigger) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_stage_automation_runs(uuid, uuid, text, public.automation_trigger) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_on_association_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_on_email_received() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_on_booking_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_on_scorecard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.automation_on_disable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_stage_automation_runs(uuid, uuid, public.automation_trigger) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_stage_automation_runs(uuid, uuid, text, public.automation_trigger) TO service_role;