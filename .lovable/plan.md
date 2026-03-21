

# Fix Resume Upload RLS Failure

## Root Cause

The `candidate_attachments` UPDATE policy has `WITH CHECK (uploaded_by = uploaded_by)` — a self-referencing tautology that's supposed to always pass. BUT when `uploaded_by` is NULL (which it is for this candidate's existing resume row), `NULL = NULL` evaluates to `NULL` (falsy in SQL), causing the "new row violates row-level security policy" error.

The upload flow at `CandidateFormSheet.tsx:378` first PATCHes existing resume rows to clear `is_resume = false`, then INSERTs the new attachment. The PATCH hits the NULL `uploaded_by` row and fails.

## Fix

### 1. Migration: Fix the UPDATE WITH CHECK policy

Replace the broken `WITH CHECK (uploaded_by = uploaded_by)` with a proper clause that handles NULLs:

```sql
DROP POLICY "candidate_attachments_update" ON candidate_attachments;

CREATE POLICY "candidate_attachments_update" ON candidate_attachments
  FOR UPDATE TO authenticated
  USING (
    (uploaded_by = auth.uid()) OR 
    (EXISTS (SELECT 1 FROM candidates c 
     WHERE c.id = candidate_attachments.candidate_id 
     AND check_org_hierarchy_role_access(c.organization_id, 'recruiter')))
  )
  WITH CHECK (true);
```

The USING clause already gates who can update. The WITH CHECK just needs to not block on NULL `uploaded_by`.

### 2. Migration: Backfill NULL uploaded_by rows

Set `uploaded_by` to the tenant's first admin for any attachment rows with NULL `uploaded_by`, preventing future edge cases.

## Files

| File | Change |
|------|--------|
| SQL migration | Fix UPDATE WITH CHECK policy; backfill NULL uploaded_by |

