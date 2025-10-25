-- ============================================================
-- Clean Up Conflicting RLS Policies on Jobs Table
-- ============================================================

-- Drop all old conflicting SELECT policies
DROP POLICY IF EXISTS "jobs_select_with_assignments" ON public.jobs;
DROP POLICY IF EXISTS "Org members can view org jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs they are assigned to" ON public.jobs;

-- Keep only these policies:
-- ✅ jobs_virgilio_hierarchy_exclude_saas (SELECT)
-- ✅ Platform admins can manage all jobs (ALL)
-- ✅ jobs_insert_policy (INSERT)
-- ✅ jobs_update_policy (UPDATE)
-- ✅ jobs_delete_policy (DELETE)

COMMENT ON POLICY jobs_virgilio_hierarchy_exclude_saas ON public.jobs IS 
  'ONLY SELECT policy: Virgilio staff see hierarchy (excluding SaaS), others see own org only. All other access controlled by role-specific policies.';