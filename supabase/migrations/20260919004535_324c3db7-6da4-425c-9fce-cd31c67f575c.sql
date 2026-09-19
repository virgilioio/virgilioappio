CREATE OR REPLACE FUNCTION public.dossier_share_is_live(_association_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM job_candidate_associations a
    JOIN jobs j ON j.id = a.job_id
    WHERE a.id = _association_id
      AND a.rejected_at IS NULL
      AND COALESCE(a.status, 'active') NOT IN ('rejected', 'withdrawn')
      AND j.status = 'open'
  )
$$;

CREATE OR REPLACE FUNCTION public.deactivate_dossier_share_on_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IN ('rejected', 'withdrawn') AND COALESCE(OLD.status, '') <> NEW.status)
     OR (NEW.rejected_at IS NOT NULL AND OLD.rejected_at IS NULL) THEN
    UPDATE dossier_shares
       SET is_public = false,
           deactivated_at = now(),
           deactivated_reason = 'candidate_rejected'
     WHERE association_id = NEW.id
       AND is_public = true;
  END IF;
  RETURN NEW;
END;
$$;