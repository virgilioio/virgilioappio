# RLS Policy Consolidation Plan

## Current State Analysis

### Jobs Table - 8 Policies
1. `Platform admins can manage all jobs - secure` (ALL)
2. `Users can view jobs in org hierarchy` (SELECT)
3. `Users can insert jobs in org` (INSERT)
4. `Users can update jobs in org` (UPDATE)
5. `Users can delete jobs in org` (DELETE)
6. `jobs_assigned_users_select` (SELECT)
7. `jobs_platform_admin_select` (SELECT)
8. `jobs_virgilio_hierarchy_exclude_saas` (SELECT)

**Problem**: Multiple overlapping SELECT policies, unclear precedence

### Candidates Table - 6 Policies
1. `Platform admins can manage all candidates` (ALL)
2. `Users can view candidates in their organization` (SELECT)
3. `Users can insert candidates in their organization` (INSERT)
4. `Users can update candidates in their organization` (UPDATE)
5. `Job assigned users can view candidates` (SELECT)
6. `candidates_virgilio_hierarchy_exclude_saas` (SELECT)

**Problem**: Similar pattern - overlapping SELECT policies

## Root Causes of Complexity

1. **Multiple User Type Systems**
   - `user_type` (platform_admin, workspace_owner, member)
   - `member_role` (admin, recruiter, hiring_manager, interviewer)
   - Organization hierarchy (parent/child orgs)

2. **Security Definer Functions Calling Other Functions**
   - `get_user_type_secure()` → checks metadata
   - `user_has_org_hierarchy_access()` → checks members + hierarchy
   - `is_user_assigned_to_job()` → checks assignments
   - `check_org_member_access()` → checks member role

3. **Legacy + Current Policies Coexist**
   - Old policies like `jobs_platform_admin_select`
   - New policies like `Platform admins can manage all jobs - secure`

4. **Virgilio-Specific Business Logic in RLS**
   - Hardcoded UUID `5ba7b145-f251-4b18-8900-724cb06028ab`
   - Email domain checks `@virgilio.tech`

## Proposed Simplified Structure

### Design Principles
1. **One policy per operation per table** (SELECT, INSERT, UPDATE, DELETE)
2. **Clear precedence hierarchy**: Platform Admin > Workspace Owner > Org Hierarchy > Job Assignment
3. **No business logic in RLS** (move Virgilio-specific rules to application layer)
4. **Consolidated helper functions** (reduce from 10+ to 3-4)

### Jobs Table - Simplified to 4 Policies

```sql
-- 1. SELECT: Consolidate all read permissions
CREATE POLICY "jobs_select_consolidated"
ON public.jobs
FOR SELECT
USING (
  -- Platform admins see all
  get_user_type_secure() = 'platform_admin'
  OR
  -- Users see jobs in their org hierarchy
  user_has_org_hierarchy_access(organization_id)
  OR
  -- Users see jobs they're assigned to
  is_user_assigned_to_job(id)
);

-- 2. INSERT: Only admins and recruiters
CREATE POLICY "jobs_insert_consolidated"
ON public.jobs
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_jobs(organization_id)
);

-- 3. UPDATE: Only admins and recruiters
CREATE POLICY "jobs_update_consolidated"
ON public.jobs
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_jobs(organization_id)
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_jobs(organization_id)
);

-- 4. DELETE: Only platform admins and workspace owners
CREATE POLICY "jobs_delete_consolidated"
ON public.jobs
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_is_workspace_owner(organization_id)
);
```

### Candidates Table - Simplified to 4 Policies

```sql
-- 1. SELECT: Consolidate all read permissions
CREATE POLICY "candidates_select_consolidated"
ON public.candidates
FOR SELECT
USING (
  -- Platform admins see all
  get_user_type_secure() = 'platform_admin'
  OR
  -- Users see candidates in their org hierarchy
  user_has_org_hierarchy_access(organization_id)
  OR
  -- Users see candidates for jobs they're assigned to
  EXISTS (
    SELECT 1 FROM job_candidate_associations jca
    WHERE jca.candidate_id = candidates.id
    AND is_user_assigned_to_job(jca.job_id)
  )
);

-- 2. INSERT: Only admins and recruiters
CREATE POLICY "candidates_insert_consolidated"
ON public.candidates
FOR INSERT
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_candidates(organization_id)
);

-- 3. UPDATE: Only admins and recruiters
CREATE POLICY "candidates_update_consolidated"
ON public.candidates
FOR UPDATE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_candidates(organization_id)
)
WITH CHECK (
  get_user_type_secure() = 'platform_admin'
  OR
  user_can_manage_candidates(organization_id)
);

-- 4. DELETE: Only platform admins and workspace owners
CREATE POLICY "candidates_delete_consolidated"
ON public.candidates
FOR DELETE
USING (
  get_user_type_secure() = 'platform_admin'
  OR
  user_is_workspace_owner(organization_id)
);
```

### Consolidated Helper Functions

```sql
-- 1. Check if user can manage jobs (admin or recruiter)
CREATE OR REPLACE FUNCTION public.user_can_manage_jobs(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.organization_id = org_id
    AND m.user_status = 'active'
    AND m.member_role IN ('admin', 'recruiter')
  );
$function$;

-- 2. Check if user can manage candidates (admin or recruiter)
CREATE OR REPLACE FUNCTION public.user_can_manage_candidates(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.organization_id = org_id
    AND m.user_status = 'active'
    AND m.member_role IN ('admin', 'recruiter')
  );
$function$;

-- 3. Check if user is workspace owner
CREATE OR REPLACE FUNCTION public.user_is_workspace_owner(org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.user_id = auth.uid()
    AND m.organization_id = org_id
    AND m.user_status = 'active'
    AND m.user_type = 'workspace_owner'
  );
$function$;
```

## Migration Strategy

### Phase 1: Jobs Table (Week 1)
1. ✅ Audit current policies (document what each does)
2. ✅ Create consolidated helper functions
3. ✅ Create new consolidated policies (disabled initially)
4. ✅ Test with existing data
5. ✅ Drop old policies
6. ✅ Enable new policies

### Phase 2: Candidates Table (Week 2)
1. ✅ Apply same process as jobs table
2. ✅ Test candidate visibility across all user roles
3. ✅ Verify job assignment access still works

### Phase 3: Related Tables (Week 3-4)
Apply same consolidation pattern to:
- `job_candidate_associations` (currently has 5 policies)
- `job_assignments` (currently has 6 policies)
- `members` (currently has multiple policies)
- `organizations` (currently has multiple policies)

### Phase 4: Cleanup (Week 5)
1. ✅ Remove unused security definer functions
2. ✅ Document final permission matrix
3. ✅ Update frontend permission hooks if needed
4. ✅ Add integration tests

## Expected Benefits

### Immediate
- **Reduce from 8 policies to 4** on jobs table
- **Reduce from 6 policies to 4** on candidates table
- **Clear policy names** that explain exactly what they do
- **Eliminate overlapping SELECT policies**

### Long-term
- **Easier debugging** - one policy per operation
- **Better performance** - fewer policy evaluations
- **Simpler onboarding** - new developers understand permissions faster
- **Reduced maintenance** - fewer places to update when adding features

## Success Metrics

1. ✅ Total RLS policies reduced by 50%+
2. ✅ No duplicate or overlapping policies
3. ✅ All existing functionality still works
4. ✅ Query performance maintained or improved
5. ✅ Clear documentation of permission hierarchy

## Rollback Plan

If issues arise:
1. Keep old policies commented in migration file
2. Can recreate old policies from migration history
3. Test rollback in staging before production
4. Document any edge cases discovered

## Next Steps

1. **Review this plan** - Get approval from team
2. **Create test scenarios** - Document all user type × role combinations
3. **Start Phase 1** - Jobs table consolidation
4. **Monitor and iterate** - Adjust based on findings

---

**Questions to resolve:**
- Should we move Virgilio-specific logic to application layer?
- Do we need to preserve organization hierarchy complexity?
- Can we simplify user_type + member_role into single system?
