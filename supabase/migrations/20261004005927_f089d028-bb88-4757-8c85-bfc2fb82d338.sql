CREATE OR REPLACE FUNCTION public.enqueue_opening_event(_opening_id uuid, _event text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE o record; j record; _sal jsonb; _cand text; _status text; _payload jsonb;
BEGIN
  SELECT * INTO o FROM public.job_openings WHERE id = _opening_id;
  IF NOT FOUND OR o.sales_deal_id IS NULL THEN RETURN; END IF;
  SELECT * INTO j FROM public.jobs WHERE id = o.job_id;
  SELECT status, candidate_name INTO _status, _cand FROM public.job_openings_with_status WHERE id = _opening_id;
  -- CHANGED: offers carry the salary too, so Gio Sales can update the fee before the hire.
  IF _event IN ('opening.filled', 'opening.offer') THEN
    SELECT public.offer_base_salary(field_values) INTO _sal FROM public.offer_letters
     WHERE opening_id = _opening_id AND coalesce(status,'') NOT IN ('withdrawn','declined','expired','rejected','cancelled')
     ORDER BY (status = 'accepted') DESC, created_at DESC LIMIT 1;
  END IF;
  _payload := jsonb_build_object(
    'idempotency_key', 'opening_' || o.id || '_' || _event || '_' || floor(extract(epoch FROM clock_timestamp())*1000)::bigint,
    'event', _event, 'deal_id', o.sales_deal_id, 'line_id', o.sales_line_id, 'ats_job_id', j.id,
    'job_title', j.title, 'job_status', j.status::text,
    'opening', jsonb_strip_nulls(jsonb_build_object(
      'opening_id', o.id, 'req_id', o.req_id, 'status', _status,
      'target_hire_date', o.target_hire_date, 'target_start_date', o.target_start_date,
      'candidate_name', _cand,
      -- CHANGED: salary and currency for offers as well as hires.
      'base_salary', CASE WHEN _event IN ('opening.filled', 'opening.offer') THEN _sal->'amount' END,
      'currency', CASE WHEN _event IN ('opening.filled', 'opening.offer') THEN coalesce(_sal->>'currency', j.currency) END,
      'filled_at', CASE WHEN _event = 'opening.filled' THEN (o.filled_at)::date END,
      'cancel_reason', CASE WHEN _event = 'opening.cancelled' THEN o.cancel_reason END)));
  INSERT INTO public.integration_outbox(tenant_id, event, payload, idempotency_key)
  VALUES (o.tenant_id, _event, _payload, _payload->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING;
END $function$;