REVOKE EXECUTE ON FUNCTION public.job_openings_enforce_deal_cap(), public.job_openings_sales_events(),
  public.offer_letters_sales_events(), public.jobs_sales_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_req_ids(uuid,int), public.enqueue_opening_event(uuid,text),
  public.sales_deal_won(uuid,jsonb), public.sales_line_updated(uuid,uuid,int,numeric), public._tenant_id_root(uuid) FROM PUBLIC, anon, authenticated;
CREATE POLICY "No direct access" ON public.integration_inbox FOR SELECT TO authenticated USING (false);