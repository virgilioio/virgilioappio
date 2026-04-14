-- Remove the CHECK constraint whose helper function (is_child_organization) is NOT
-- SECURITY DEFINER and queries the RLS-protected organizations table, causing 42501
-- errors during INSERT for non-superusers. The jobs_before_insert trigger already
-- enforces the same invariant as SECURITY DEFINER.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_must_reference_child_org;

-- Drop the orphaned helper since no caller remains.
DROP FUNCTION IF EXISTS public.is_child_organization(uuid);