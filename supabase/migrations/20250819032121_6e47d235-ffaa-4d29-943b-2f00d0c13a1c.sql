
-- 1) Create a SECURITY DEFINER function to check if an organization has at least one active public posting
CREATE OR REPLACE FUNCTION public.organization_has_active_public_posting(org_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.job_postings jp ON jp.job_id = j.id
    WHERE j.organization_id = org_id_param
      AND jp.is_active = true
  );
$$;

-- 2) Allow anonymous SELECT on organizations that have at least one active posting
DROP POLICY IF EXISTS "Public can view organizations with active postings - safe" ON public.organizations;

CREATE POLICY "Public can view organizations with active postings - safe"
ON public.organizations
FOR SELECT
USING (public.organization_has_active_public_posting(id));
