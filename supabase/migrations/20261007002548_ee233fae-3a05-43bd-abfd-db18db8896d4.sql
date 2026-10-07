CREATE TABLE public.req_id_counters (
  tenant_id uuid PRIMARY KEY,
  prefix text NOT NULL DEFAULT 'REQ-',
  width int NOT NULL DEFAULT 4,
  last_n bigint NOT NULL DEFAULT 1000,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.req_id_counters TO service_role;
ALTER TABLE public.req_id_counters ENABLE ROW LEVEL SECURITY;

INSERT INTO public.req_id_counters(tenant_id, prefix, width, last_n)
SELECT DISTINCT ON (tenant_id) tenant_id, m[1], length(m[2]), m[2]::bigint
FROM (SELECT tenant_id, regexp_match(upper(btrim(req_id)), '^(.*?)(\d+)$') m FROM public.job_openings WHERE tenant_id IS NOT NULL) s
WHERE m IS NOT NULL
ORDER BY tenant_id, m[2]::bigint DESC
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.allocate_req_ids(_tenant_id uuid, _count int)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; _out text[] := '{}'; i int;
BEGIN
  INSERT INTO public.req_id_counters(tenant_id) VALUES (_tenant_id) ON CONFLICT DO NOTHING;
  SELECT * INTO c FROM public.req_id_counters WHERE tenant_id = _tenant_id FOR UPDATE;
  FOR i IN 1..greatest(coalesce(_count,0),0) LOOP
    _out := _out || (c.prefix || lpad((c.last_n + i)::text, c.width, '0'));
  END LOOP;
  UPDATE public.req_id_counters SET last_n = last_n + greatest(coalesce(_count,0),0), updated_at = now() WHERE tenant_id = _tenant_id;
  RETURN _out;
END $$;
REVOKE EXECUTE ON FUNCTION public.allocate_req_ids(uuid,int) FROM PUBLIC, anon, authenticated;

-- Preview only: does not consume numbers
CREATE OR REPLACE FUNCTION public.next_req_ids(_tenant_id uuid, _count int)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _p text := 'REQ-'; _w int := 4; _n bigint := 1000; _out text[] := '{}'; i int;
BEGIN
  SELECT prefix, width, last_n INTO _p, _w, _n FROM public.req_id_counters WHERE tenant_id = _tenant_id;
  IF NOT FOUND THEN _p := 'REQ-'; _w := 4; _n := 1000; END IF;
  FOR i IN 1..greatest(coalesce(_count,0),0) LOOP
    _out := _out || (_p || lpad((_n + i)::text, _w, '0'));
  END LOOP;
  RETURN _out;
END $$;
REVOKE EXECUTE ON FUNCTION public.next_req_ids(uuid,int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.job_openings_assign_req_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tenant_id IS NULL THEN
      SELECT tenant_id INTO NEW.tenant_id FROM public.jobs WHERE id = NEW.job_id;
    END IF;
    NEW.req_id := (public.allocate_req_ids(NEW.tenant_id, 1))[1];
  ELSIF NEW.req_id IS DISTINCT FROM OLD.req_id THEN
    RAISE EXCEPTION 'Req IDs are assigned automatically and cannot be changed.';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.job_openings_assign_req_id() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER a0_job_openings_assign_req_id
BEFORE INSERT OR UPDATE OF req_id ON public.job_openings
FOR EACH ROW EXECUTE FUNCTION public.job_openings_assign_req_id();