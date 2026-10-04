CREATE OR REPLACE FUNCTION public.sales_deal_won(_tenant_id uuid, _p jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _org uuid; _line jsonb; _job record; _job_id uuid; _ids text[]; _i int; _hires int;
  _out jsonb := '[]'::jsonb; _openings jsonb; _pos int; _owner uuid; _team jsonb; _names text;
  _deal jsonb := _p->'deal'; _co jsonb := _p->'company'; _attr jsonb := nullif(_p->'attribution', 'null'::jsonb);
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

  IF _attr IS NOT NULL THEN
    SELECT string_agg(x->>'name', ', ') INTO _names FROM (
      SELECT jsonb_array_elements(coalesce(_attr->'sales','[]'::jsonb)) x
      UNION ALL SELECT jsonb_array_elements(coalesce(_attr->'es','[]'::jsonb))) s;
  END IF;

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
        sales_deal_owner = coalesce(sales_deal_owner, _deal->>'owner_name'), sales_deal_won_at = coalesce(sales_deal_won_at, (_deal->>'won_at')::date),
        sales_team = coalesce(sales_team, _attr)
      WHERE id = _job_id;
      IF _attr IS NOT NULL AND _job.sales_team IS NOT NULL AND _job.sales_team IS DISTINCT FROM _attr THEN
        INSERT INTO public.activities (user_id, organization_id, activity_type, title, description, metadata, entity_type, entity_id, tenant_id)
        VALUES (coalesce(_owner, _job.created_by), _org, 'job_updated', 'Deal attribution kept',
          'Deal ' || coalesce(_deal->>'title','') || ' credits ' || coalesce(_names,'—') || '; this job keeps its current Sales/ES',
          jsonb_build_object('jobId', _job_id, 'dealId', _deal->>'id', 'attribution', _attr), 'job', _job_id, _tenant_id);
      END IF;
    ELSE
      INSERT INTO public.jobs(title, organization_id, tenant_id, status, currency, created_by,
        sales_deal_id, sales_deal_title, sales_deal_url, sales_deal_owner, sales_deal_won_at, sales_team)
      VALUES (_line->>'role', _org, _tenant_id, 'draft', coalesce(_line->>'currency','USD'), _owner,
        (_deal->>'id')::uuid, _deal->>'title', _deal->>'url', _deal->>'owner_name', (_deal->>'won_at')::date, _attr)
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
    _team := jsonb_build_object(
      'sourcers', coalesce((SELECT jsonb_agg(public.ats_person(a.user_id)) FROM public.job_assignments a
                            WHERE a.job_id = _job_id AND a.role = 'sourcer' AND a.deleted_at IS NULL), '[]'::jsonb),
      'recruiters', coalesce((SELECT jsonb_agg(public.ats_person(a.user_id)) FROM public.job_assignments a
                              WHERE a.job_id = _job_id AND a.role = 'recruiter' AND a.deleted_at IS NULL), '[]'::jsonb));
    _out := _out || jsonb_build_object('line_id', _line->>'line_id', 'ats_job_id', _job_id, 'job_title', _job.title,
      'job_status', _job.status::text, 'openings', _openings, 'team', _team);
  END LOOP;
  RETURN jsonb_build_object('lines', _out);
END $function$;

CREATE OR REPLACE FUNCTION public.sales_attribution_updated(_tenant_id uuid, _deal_id uuid, _attribution jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _n int;
BEGIN
  UPDATE public.jobs SET sales_team = _attribution
   WHERE tenant_id = _tenant_id AND sales_deal_id = _deal_id AND deleted_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'jobs_updated', _n);
END $function$;
REVOKE EXECUTE ON FUNCTION public.sales_attribution_updated(uuid, uuid, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_attribution_updated(uuid, uuid, jsonb) TO service_role;