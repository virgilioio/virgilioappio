CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  req_id text NOT NULL,
  target_hire_date date NOT NULL,
  target_start_date date NOT NULL,
  position int NOT NULL DEFAULT 0,
  hired_association_id uuid REFERENCES public.job_candidate_associations(id) ON DELETE SET NULL,
  filled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_openings_tenant_req_uidx ON public.job_openings (tenant_id, lower(req_id));
CREATE INDEX job_openings_job_idx ON public.job_openings (job_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_openings TO authenticated;
GRANT ALL ON public.job_openings TO service_role;
ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;

CREATE POLICY job_openings_select ON public.job_openings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id));
CREATE POLICY job_openings_insert ON public.job_openings FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND ((get_user_type_secure() = 'platform_admin') OR check_org_hierarchy_role_access(j.organization_id, 'recruiter') OR is_user_assigned_to_job(j.id))));
CREATE POLICY job_openings_update ON public.job_openings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND ((get_user_type_secure() = 'platform_admin') OR check_org_hierarchy_role_access(j.organization_id, 'recruiter') OR is_user_assigned_to_job(j.id))))
WITH CHECK (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND ((get_user_type_secure() = 'platform_admin') OR check_org_hierarchy_role_access(j.organization_id, 'recruiter') OR is_user_assigned_to_job(j.id))));
CREATE POLICY job_openings_delete ON public.job_openings FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_id AND ((get_user_type_secure() = 'platform_admin') OR check_org_hierarchy_role_access(j.organization_id, 'recruiter') OR is_user_assigned_to_job(j.id))));

ALTER TABLE public.offer_letters ADD COLUMN IF NOT EXISTS opening_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL;
ALTER TABLE public.job_candidate_associations ADD COLUMN IF NOT EXISTS opening_id uuid REFERENCES public.job_openings(id) ON DELETE SET NULL;

-- Active offer helper
CREATE OR REPLACE FUNCTION public.job_opening_active_offer(_opening_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.offer_letters
  WHERE opening_id = _opening_id
    AND coalesce(status,'') NOT IN ('withdrawn','declined','expired','rejected','cancelled')
  ORDER BY created_at DESC LIMIT 1
$$;

-- Validation + req lock + tenant fill
CREATE OR REPLACE FUNCTION public.job_openings_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.req_id := upper(btrim(NEW.req_id));
  IF NEW.req_id = '' THEN RAISE EXCEPTION 'Req ID is required.'; END IF;
  IF NEW.target_start_date < NEW.target_hire_date THEN
    RAISE EXCEPTION 'Target start date is before the target hire date.';
  END IF;
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.jobs WHERE id = NEW.job_id;
  END IF;
  IF TG_OP = 'UPDATE' AND lower(NEW.req_id) <> lower(OLD.req_id)
     AND (OLD.hired_association_id IS NOT NULL OR public.job_opening_active_offer(OLD.id) IS NOT NULL) THEN
    RAISE EXCEPTION 'Req ID is locked — this opening is linked to a candidate.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.job_openings o WHERE o.id <> NEW.id
             AND o.tenant_id IS NOT DISTINCT FROM NEW.tenant_id AND lower(o.req_id) = lower(NEW.req_id)) THEN
    RAISE EXCEPTION '% is already used by another opening.', NEW.req_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER job_openings_before_write BEFORE INSERT OR UPDATE ON public.job_openings
FOR EACH ROW EXECUTE FUNCTION public.job_openings_before_write();

CREATE OR REPLACE FUNCTION public.job_openings_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text;
BEGIN
  IF pg_trigger_depth() > 1 OR NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = OLD.job_id) THEN RETURN OLD; END IF;
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
CREATE TRIGGER job_openings_before_delete BEFORE DELETE ON public.job_openings
FOR EACH ROW EXECUTE FUNCTION public.job_openings_before_delete();

-- Derived jobs.target_fill_date
CREATE OR REPLACE FUNCTION public.sync_job_target_fill_date(_job_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.jobs SET target_fill_date = (
    SELECT min(target_hire_date) FROM public.job_openings WHERE job_id = _job_id AND hired_association_id IS NULL
  ) WHERE id = _job_id
$$;
CREATE OR REPLACE FUNCTION public.job_openings_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sync_job_target_fill_date(coalesce(NEW.job_id, OLD.job_id));
  RETURN NULL;
END $$;
CREATE TRIGGER job_openings_after_change AFTER INSERT OR UPDATE OR DELETE ON public.job_openings
FOR EACH ROW EXECUTE FUNCTION public.job_openings_after_change();

-- Status view
CREATE OR REPLACE VIEW public.job_openings_with_status WITH (security_invoker = true) AS
SELECT o.*,
  CASE WHEN o.hired_association_id IS NOT NULL THEN 'filled'
       WHEN ao.offer_id IS NOT NULL THEN 'offer' ELSE 'open' END AS status,
  coalesce(hc.candidate_name, oc.candidate_name) AS candidate_name,
  coalesce(hc.id, oc.id) AS candidate_id
FROM public.job_openings o
LEFT JOIN LATERAL (SELECT public.job_opening_active_offer(o.id) AS offer_id) ao ON true
LEFT JOIN public.job_candidate_associations ha ON ha.id = o.hired_association_id
LEFT JOIN public.candidates hc ON hc.id = ha.candidate_id
LEFT JOIN public.offer_letters ol ON ol.id = ao.offer_id
LEFT JOIN public.candidates oc ON oc.id = ol.candidate_id;
GRANT SELECT ON public.job_openings_with_status TO authenticated;

-- Backfill: one opening per hire (min one per job), numbered REQ-1001.. per workspace
WITH slots AS (
  SELECT j.id AS job_id, j.tenant_id, j.created_at, j.target_fill_date,
         h.assoc_id, h.hired_at, coalesce(h.rn, 1) AS slot
  FROM public.jobs j
  LEFT JOIN LATERAL (
    SELECT a.id AS assoc_id, a.hired_at, row_number() OVER (ORDER BY coalesce(a.hired_at, a.updated_at), a.id) AS rn
    FROM public.job_candidate_associations a WHERE a.job_id = j.id AND a.status = 'hired'
  ) h ON true
), numbered AS (
  SELECT s.*, row_number() OVER (PARTITION BY s.tenant_id ORDER BY s.created_at, s.job_id, s.slot) AS n
  FROM slots s
)
INSERT INTO public.job_openings (tenant_id, job_id, req_id, target_hire_date, target_start_date, position, hired_association_id, filled_at)
SELECT tenant_id, job_id, 'REQ-' || (1000 + n),
  d, d + 14, slot - 1, assoc_id, CASE WHEN assoc_id IS NOT NULL THEN coalesce(hired_at, now()) END
FROM numbered, LATERAL (SELECT coalesce(target_fill_date, (created_at + interval '45 days')::date) AS d) x;

UPDATE public.job_candidate_associations a SET opening_id = o.id
FROM public.job_openings o WHERE o.hired_association_id = a.id;

UPDATE public.offer_letters ol SET opening_id = (
  SELECT o.id FROM public.job_openings o WHERE o.job_id = ol.job_id AND o.hired_association_id IS NULL ORDER BY o.position LIMIT 1)
WHERE ol.opening_id IS NULL AND ol.job_id IS NOT NULL;