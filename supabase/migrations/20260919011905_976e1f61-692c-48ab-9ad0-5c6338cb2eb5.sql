REVOKE ALL ON FUNCTION public.record_dossier_view(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_dossier_view(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_client_verdict(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_client_verdict(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.tg_resolve_client_verdict_on_association() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_resolve_client_verdict_on_booking() FROM PUBLIC, anon, authenticated;