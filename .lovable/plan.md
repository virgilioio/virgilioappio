

# Fix: SaaS Customers Can't See Enriched Candidate Data (Work Experience, Education, Certifications)

## Root Cause

A **tenant vs organization mismatch** in RLS policies on three tables:

- `candidates` table: uses `user_has_tenant_access(tenant_id)` -- tenant-aware, works correctly
- `candidate_work_experience`: RLS joins `candidates.organization_id = members.organization_id` -- org-level, broken
- `candidate_education`: same org-level join -- broken
- `candidate_certifications`: same org-level join -- broken

When candidates are assigned to child organizations (e.g., "Sales" department under Motive), the org IDs don't match the parent Motive org, so RLS returns empty results. Platform admins bypass this via `get_user_type_secure() = 'platform_admin'`.

## Fix: Update RLS to Use Tenant-Based Access

**Database migration** -- Update SELECT/INSERT/UPDATE/DELETE policies on all three tables to use `user_has_tenant_access()` on the candidate's `tenant_id` instead of matching `organization_id`:

```sql
-- For each of the 3 tables, replace the org-based check:
--   EXISTS (SELECT 1 FROM candidates c JOIN members m 
--     ON m.organization_id = c.organization_id 
--     WHERE c.id = X.candidate_id AND m.user_id = auth.uid())
-- With tenant-based check:
--   EXISTS (SELECT 1 FROM candidates c 
--     WHERE c.id = X.candidate_id 
--     AND user_has_tenant_access(c.tenant_id))

-- candidate_work_experience: drop 4 policies, recreate with tenant check
-- candidate_education: drop 4 policies, recreate with tenant check  
-- candidate_certifications: drop 5 policies (incl service role), recreate with tenant check
```

This aligns these tables with the same tenant-based access pattern already used by the `candidates` table itself. No frontend changes needed -- the queries already exist, they just return empty due to RLS blocking.

