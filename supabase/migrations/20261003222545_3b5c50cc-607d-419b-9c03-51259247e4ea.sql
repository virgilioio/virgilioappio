ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS sales_deal_id uuid,
  ADD COLUMN IF NOT EXISTS sales_deal_title text,
  ADD COLUMN IF NOT EXISTS sales_deal_url text,
  ADD COLUMN IF NOT EXISTS sales_deal_owner text,
  ADD COLUMN IF NOT EXISTS sales_deal_won_at date;
ALTER TABLE public.job_openings
  ADD COLUMN IF NOT EXISTS sales_deal_id uuid,
  ADD COLUMN IF NOT EXISTS sales_line_id uuid,
  ADD COLUMN IF NOT EXISTS fee_pct numeric,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS sales_company_id uuid;
CREATE INDEX IF NOT EXISTS idx_org_sales_company ON public.organizations(tenant_id, sales_company_id);
CREATE INDEX IF NOT EXISTS idx_job_openings_sales_line ON public.job_openings(sales_line_id);

CREATE TABLE public.job_sales_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL,
  line_id uuid NOT NULL UNIQUE,
  hires integer NOT NULL,
  fee_pct numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.job_sales_lines TO authenticated;
GRANT ALL ON public.job_sales_lines TO service_role;
ALTER TABLE public.job_sales_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read deal lines" ON public.job_sales_lines FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

CREATE TABLE public.integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  target text NOT NULL DEFAULT 'gio_sales',
  event text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_due ON public.integration_outbox(next_attempt_at) WHERE delivered_at IS NULL;
GRANT SELECT ON public.integration_outbox TO authenticated;
GRANT ALL ON public.integration_outbox TO service_role;
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read outbox" ON public.integration_outbox FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = auth.uid() AND m.tenant_id = integration_outbox.tenant_id
    AND (m.system_role = 'admin' OR m.user_type IN ('workspace_owner','platform_admin'))));

CREATE TABLE public.integration_inbox (
  idempotency_key text PRIMARY KEY,
  endpoint text,
  status_code int NOT NULL DEFAULT 200,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.integration_inbox TO service_role;
ALTER TABLE public.integration_inbox ENABLE ROW LEVEL SECURITY;

-- Derived status with cancelled
CREATE OR REPLACE VIEW public.job_openings_with_status WITH (security_invoker = true) AS
SELECT o.id, o.tenant_id, o.job_id, o.req_id, o.target_hire_date, o.target_start_date, o."position",
  o.hired_association_id, o.filled_at, o.created_at, o.updated_at,
  CASE WHEN o.cancelled_at IS NOT NULL THEN 'cancelled'
       WHEN o.hired_association_id IS NOT NULL THEN 'filled'
       WHEN ao.offer_id IS NOT NULL THEN 'offer'
       ELSE 'open' END AS status,
  COALESCE(hc.candidate_name, oc.candidate_name) AS candidate_name,
  COALESCE(hc.id, oc.id) AS candidate_id,
  o.sales_deal_id, o.sales_line_id, o.fee_pct, o.cancelled_at, o.cancel_reason
FROM job_openings o
LEFT JOIN LATERAL (SELECT CASE WHEN o.cancelled_at IS NULL THEN job_opening_active_offer(o.id) END AS offer_id) ao ON true
LEFT JOIN job_candidate_associations ha ON ha.id = o.hired_association_id
LEFT JOIN candidates hc ON hc.id = ha.candidate_id
LEFT JOIN offer_letters ol ON ol.id = ao.offer_id
LEFT JOIN candidates oc ON oc.id = ol.candidate_id;

CREATE OR REPLACE FUNCTION public.sync_job_target_fill_date(_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.jobs SET target_fill_date = (
    SELECT min(target_hire_date) FROM public.job_openings
    WHERE job_id = _job_id AND hired_association_id IS NULL AND cancelled_at IS NULL
  ) WHERE id = _job_id
$$;

CREATE OR REPLACE FUNCTION public.job_openings_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id) THEN RETURN OLD; END IF;
  IF OLD.sales_line_id IS NOT NULL THEN
    RAISE EXCEPTION 'This opening comes from a won deal — cancel it instead of removing it.';
  END IF;
  IF OLD.hired_association_id IS NOT NULL THEN
    RAISE EXCEPTION 'This opening is filled and can''t be removed.';
  END IF;
  IF public.job_opening_active_offer(OLD.id) IS NOT NULL THEN
    RAISE EXCEPTION 'This opening is reserved by an offer — withdraw the offer to remove it.';
  END IF;
  IF (SELECT count(*) FROM public.job_openings WHERE job_id = OLD.job_id) <= 1 THEN
    RAISE EXCEPTION 'A job needs at least one opening.';
  END IF;
  RETURN OLD;
END $$;

-- Cap: openings per deal line <= line hires. Openings added on a deal job inherit the line.
CREATE OR REPLACE FUNCTION public.job_openings_enforce_deal_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _line record; _used int;
BEGIN
  IF NEW.sales_line_id IS NULL AND TG_OP = 'INSERT' THEN
    SELECT * INTO _line FROM public.job_sales_lines WHERE job_id = NEW.job_id ORDER BY created_at LIMIT 1;
    IF FOUND THEN
      NEW.sales_line_id := _line.line_id; NEW.sales_deal_id := _line.deal_id; NEW.fee_pct := _line.fee_pct;
    END IF;
  END IF;
  IF NEW.sales_line_id IS NULL OR NEW.cancelled_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.cancelled_at IS NULL AND OLD.sales_line_id IS NOT DISTINCT FROM NEW.sales_line_id THEN RETURN NEW; END IF;
  SELECT * INTO _line FROM public.job_sales_lines WHERE line_id = NEW.sales_line_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  SELECT count(*) INTO _used FROM public.job_openings
   WHERE sales_line_id = NEW.sales_line_id AND cancelled_at IS NULL AND id <> NEW.id;
  IF _used + 1 > _line.hires THEN
    RAISE EXCEPTION 'All % hires on the deal are in use. Ask sales to update the deal to add more openings.', _line.hires;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER job_openings_deal_cap BEFORE INSERT OR UPDATE OF cancelled_at, sales_line_id ON public.job_openings
  FOR EACH ROW EXECUTE FUNCTION public.job_openings_enforce_deal_cap();

-- Next Req IDs (prefix of highest numeric suffix in workspace, +1..+n)
CREATE OR REPLACE FUNCTION public.next_req_ids(_tenant_id uuid, _count int)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _prefix text := 'REQ-'; _n bigint := 1000; _w int := 4; r record; _out text[] := '{}'; i int;
BEGIN
  SELECT (regexp_match(upper(btrim(req_id)), '^(.*?)(\d+)$')) AS m INTO r
  FROM public.job_openings WHERE tenant_id = _tenant_id AND upper(btrim(req_id)) ~ '\d+$'
  ORDER BY ((regexp_match(upper(btrim(req_id)), '(\d+)$'))[1])::bigint DESC LIMIT 1;
  IF FOUND AND r.m IS NOT NULL THEN _prefix := r.m[1]; _n := r.m[2]::bigint; _w := length(r.m[2]); END IF;
  FOR i IN 1..greatest(coalesce(_count,0),0) LOOP
    _out := _out || (_prefix || lpad((_n + i)::text, _w, '0'));
  END LOOP;
  RETURN _out;
END $$;
REVOKE EXECUTE ON FUNCTION public.next_req_ids(uuid,int) FROM PUBLIC, anon, authenticated;

-- Base salary from offer field_values
CREATE OR REPLACE FUNCTION public.offer_base_salary(_fv jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE _raw text; _j jsonb;
BEGIN
  _raw := coalesce(_fv->>'base_salary', _fv->>'salary', _fv->>'base_pay');
  IF _raw IS NULL THEN RETURN NULL; END IF;
  BEGIN _j := _raw::jsonb; EXCEPTION WHEN others THEN _j := NULL; END;
  IF jsonb_typeof(_j) = 'object' THEN
    RETURN jsonb_build_object('amount', nullif(regexp_replace(coalesce(_j->>'amount',''), '[^0-9.]', '', 'g'),'')::numeric, 'currency', _j->>'currency');
  END IF;
  RETURN jsonb_build_object('amount', nullif(regexp_replace(_raw, '[^0-9.]', '', 'g'),'')::numeric, 'currency', NULL);
END $$;

-- Outbox enqueue
CREATE OR REPLACE FUNCTION public.enqueue_opening_event(_opening_id uuid, _event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; j record; _sal jsonb; _cand text; _status text; _payload jsonb;
BEGIN
  SELECT * INTO o FROM public.job_openings WHERE id = _opening_id;
  IF NOT FOUND OR o.sales_deal_id IS NULL THEN RETURN; END IF;
  SELECT * INTO j FROM public.jobs WHERE id = o.job_id;
  SELECT status, candidate_name INTO _status, _cand FROM public.job_openings_with_status WHERE id = _opening_id;
  IF _event = 'opening.filled' THEN
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
      'base_salary', CASE WHEN _event = 'opening.filled' THEN _sal->'amount' END,
      'currency', CASE WHEN _event = 'opening.filled' THEN coalesce(_sal->>'currency', j.currency) END,
      'filled_at', CASE WHEN _event = 'opening.filled' THEN (o.filled_at)::date END,
      'cancel_reason', CASE WHEN _event = 'opening.cancelled' THEN o.cancel_reason END)));
  INSERT INTO public.integration_outbox(tenant_id, event, payload, idempotency_key)
  VALUES (o.tenant_id, _event, _payload, _payload->>'idempotency_key')
  ON CONFLICT (idempotency_key) DO NOTHING;
END $$;
REVOKE EXECUTE ON FUNCTION public.enqueue_opening_event(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.job_openings_sales_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.sales_deal_id IS NULL THEN RETURN NULL; END IF;
  IF OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL THEN
    PERFORM public.enqueue_opening_event(NEW.id, 'opening.cancelled');
  ELSIF OLD.hired_association_id IS NULL AND NEW.hired_association_id IS NOT NULL THEN
    PERFORM public.enqueue_opening_event(NEW.id, 'opening.filled');
  ELSIF OLD.target_hire_date IS DISTINCT FROM NEW.target_hire_date OR OLD.target_start_date IS DISTINCT FROM NEW.target_start_date THEN
    PERFORM public.enqueue_opening_event(NEW.id, 'opening.dates_changed');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER job_openings_sales_events AFTER UPDATE ON public.job_openings
  FOR EACH ROW EXECUTE FUNCTION public.job_openings_sales_events();

CREATE OR REPLACE FUNCTION public.offer_letters_sales_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _dead text[] := ARRAY['withdrawn','declined','expired','rejected','cancelled'];
  _was boolean; _is boolean;
BEGIN
  _is := NEW.opening_id IS NOT NULL AND NOT (coalesce(NEW.status,'') = ANY(_dead));
  IF TG_OP = 'INSERT' THEN
    IF _is THEN PERFORM public.enqueue_opening_event(NEW.opening_id, 'opening.offer'); END IF;
    RETURN NULL;
  END IF;
  _was := OLD.opening_id IS NOT NULL AND NOT (coalesce(OLD.status,'') = ANY(_dead));
  IF _was AND (NOT _is OR OLD.opening_id IS DISTINCT FROM NEW.opening_id) THEN
    PERFORM public.enqueue_opening_event(OLD.opening_id, 'opening.offer_released');
  END IF;
  IF _is AND (NOT _was OR OLD.opening_id IS DISTINCT FROM NEW.opening_id) THEN
    PERFORM public.enqueue_opening_event(NEW.opening_id, 'opening.offer');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER offer_letters_sales_events AFTER INSERT OR UPDATE OF status, opening_id ON public.offer_letters
  FOR EACH ROW EXECUTE FUNCTION public.offer_letters_sales_events();

CREATE OR REPLACE FUNCTION public.jobs_sales_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record;
BEGIN
  IF NEW.sales_deal_id IS NULL OR OLD.status::text <> 'draft' OR NEW.status::text <> 'open' THEN RETURN NULL; END IF;
  FOR o IN SELECT id FROM public.job_openings WHERE job_id = NEW.id AND sales_deal_id IS NOT NULL AND cancelled_at IS NULL ORDER BY position LOOP
    PERFORM public.enqueue_opening_event(o.id, 'job.published');
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER jobs_sales_events AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_sales_events();

-- Inbound: deal won (atomic)
CREATE OR REPLACE FUNCTION public.sales_deal_won(_tenant_id uuid, _p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _org uuid; _line jsonb; _job record; _job_id uuid; _ids text[]; _i int; _hires int;
  _out jsonb := '[]'::jsonb; _openings jsonb; _pos int; _owner uuid;
  _deal jsonb := _p->'deal'; _co jsonb := _p->'company';
BEGIN
  IF nullif(_co->>'ats_client_id','') IS NOT NULL THEN
    SELECT id INTO _org FROM public.organizations WHERE id = (_co->>'ats_client_id')::uuid AND tenant_id = _tenant_id;
  END IF;
  IF _org IS NULL THEN
    SELECT id INTO _org FROM public.organizations WHERE tenant_id = _tenant_id AND sales_company_id = (_co->>'id')::uuid LIMIT 1;
  END IF;
  IF _org IS NULL THEN
    SELECT id INTO _org FROM public.organizations WHERE tenant_id = _tenant_id AND org_kind = 'client'
      AND lower(btrim(name)) = lower(btrim(_co->>'name')) LIMIT 1;
  END IF;
  IF _org IS NULL THEN
    INSERT INTO public.organizations(name, tenant_id, org_kind, organization_type, status, parent_organization_id, sales_company_id)
    VALUES (btrim(_co->>'name'), _tenant_id, 'client', 'client', 'active', _tenant_id_root(_tenant_id), (_co->>'id')::uuid)
    RETURNING id INTO _org;
  ELSE
    UPDATE public.organizations SET sales_company_id = (_co->>'id')::uuid WHERE id = _org AND sales_company_id IS NULL;
  END IF;
  SELECT account_owner_id INTO _owner FROM public.organizations WHERE id = _org;

  FOR _line IN SELECT * FROM jsonb_array_elements(_p->'lines') LOOP
    _hires := (_line->>'hires')::int;
    IF EXISTS (SELECT 1 FROM public.job_sales_lines WHERE line_id = (_line->>'line_id')::uuid) THEN
      RAISE EXCEPTION 'LINE_EXISTS:%', _line->>'line_id';
    END IF;
    IF _line->>'mode' = 'existing' THEN
      SELECT * INTO _job FROM public.jobs WHERE id = (_line->>'ats_job_id')::uuid AND tenant_id = _tenant_id AND deleted_at IS NULL;
      IF NOT FOUND OR _job.organization_id <> _org THEN
        RAISE EXCEPTION 'JOB_NOT_FOR_CLIENT:%', _line->>'ats_job_id';
      END IF;
      _job_id := _job.id;
      UPDATE public.jobs SET sales_deal_id = coalesce(sales_deal_id, (_deal->>'id')::uuid),
        sales_deal_title = coalesce(sales_deal_title, _deal->>'title'), sales_deal_url = coalesce(sales_deal_url, _deal->>'url'),
        sales_deal_owner = coalesce(sales_deal_owner, _deal->>'owner_name'), sales_deal_won_at = coalesce(sales_deal_won_at, (_deal->>'won_at')::date)
      WHERE id = _job_id;
    ELSE
      INSERT INTO public.jobs(title, organization_id, tenant_id, status, currency, created_by,
        sales_deal_id, sales_deal_title, sales_deal_url, sales_deal_owner, sales_deal_won_at)
      VALUES (_line->>'role', _org, _tenant_id, 'draft', coalesce(_line->>'currency','USD'), _owner,
        (_deal->>'id')::uuid, _deal->>'title', _deal->>'url', _deal->>'owner_name', (_deal->>'won_at')::date)
      RETURNING id INTO _job_id;
    END IF;
    INSERT INTO public.job_sales_lines(tenant_id, job_id, deal_id, line_id, hires, fee_pct)
    VALUES (_tenant_id, _job_id, (_deal->>'id')::uuid, (_line->>'line_id')::uuid, _hires, (_line->>'fee_pct')::numeric);
    _ids := public.next_req_ids(_tenant_id, _hires);
    SELECT coalesce(max(position),-1)+1 INTO _pos FROM public.job_openings WHERE job_id = _job_id;
    FOR _i IN 1.._hires LOOP
      INSERT INTO public.job_openings(job_id, tenant_id, req_id, target_hire_date, target_start_date, position,
        sales_deal_id, sales_line_id, fee_pct)
      VALUES (_job_id, _tenant_id, _ids[_i], (_line->>'target_hire_date')::date, (_line->>'target_start_date')::date, _pos + _i - 1,
        (_deal->>'id')::uuid, (_line->>'line_id')::uuid, (_line->>'fee_pct')::numeric);
    END LOOP;
    SELECT coalesce(jsonb_agg(jsonb_build_object('opening_id', id, 'req_id', req_id, 'target_hire_date', target_hire_date,
      'target_start_date', target_start_date, 'status', status) ORDER BY position), '[]'::jsonb)
      INTO _openings FROM public.job_openings_with_status WHERE sales_line_id = (_line->>'line_id')::uuid;
    SELECT * INTO _job FROM public.jobs WHERE id = _job_id;
    _out := _out || jsonb_build_object('line_id', _line->>'line_id', 'ats_job_id', _job_id, 'job_title', _job.title,
      'job_status', _job.status::text, 'openings', _openings);
  END LOOP;
  RETURN jsonb_build_object('lines', _out);
END $$;

CREATE OR REPLACE FUNCTION public._tenant_id_root(_tenant_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT id FROM public.organizations WHERE tenant_id = _tenant_id AND org_kind = 'root' ORDER BY created_at LIMIT 1
$$;

-- Inbound: line updated
CREATE OR REPLACE FUNCTION public.sales_line_updated(_tenant_id uuid, _line_id uuid, _hires int, _fee numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _l record; _active int; _last record; _ids text[]; _i int; _pos int;
BEGIN
  SELECT * INTO _l FROM public.job_sales_lines WHERE line_id = _line_id AND tenant_id = _tenant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','LINE_NOT_FOUND'); END IF;
  SELECT count(*) INTO _active FROM public.job_openings WHERE sales_line_id = _line_id AND cancelled_at IS NULL;
  IF _hires < _active THEN
    RETURN jsonb_build_object('error','HIRES_BELOW_ACTIVE','active', _active,
      'open_req_ids', (SELECT coalesce(jsonb_agg(req_id ORDER BY position), '[]'::jsonb) FROM public.job_openings_with_status
                        WHERE sales_line_id = _line_id AND status = 'open'));
  END IF;
  UPDATE public.job_sales_lines SET hires = _hires, fee_pct = coalesce(_fee, fee_pct), updated_at = now() WHERE id = _l.id;
  UPDATE public.job_openings SET fee_pct = coalesce(_fee, fee_pct) WHERE sales_line_id = _line_id;
  IF _hires > _active THEN
    SELECT * INTO _last FROM public.job_openings WHERE sales_line_id = _line_id ORDER BY position DESC, created_at DESC LIMIT 1;
    _ids := public.next_req_ids(_tenant_id, _hires - _active);
    SELECT coalesce(max(position),-1)+1 INTO _pos FROM public.job_openings WHERE job_id = _l.job_id;
    FOR _i IN 1..(_hires - _active) LOOP
      INSERT INTO public.job_openings(job_id, tenant_id, req_id, target_hire_date, target_start_date, position, sales_deal_id, sales_line_id, fee_pct)
      VALUES (_l.job_id, _tenant_id, _ids[_i], _last.target_hire_date, _last.target_start_date, _pos + _i - 1, _l.deal_id, _line_id, coalesce(_fee, _l.fee_pct));
    END LOOP;
  END IF;
  RETURN jsonb_build_object('line_id', _line_id, 'ats_job_id', _l.job_id, 'hires', _hires,
    'openings', (SELECT coalesce(jsonb_agg(jsonb_build_object('opening_id', id, 'req_id', req_id, 'target_hire_date', target_hire_date,
      'target_start_date', target_start_date, 'status', status) ORDER BY position), '[]'::jsonb)
      FROM public.job_openings_with_status WHERE sales_line_id = _line_id));
END $$;

REVOKE EXECUTE ON FUNCTION public.sales_deal_won(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sales_line_updated(uuid,uuid,int,numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._tenant_id_root(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_deal_won(uuid,jsonb), public.sales_line_updated(uuid,uuid,int,numeric),
  public.next_req_ids(uuid,int), public._tenant_id_root(uuid) TO service_role;