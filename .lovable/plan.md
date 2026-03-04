

# Fix: Add Missing Write RLS Policies for `offer_letters`

## Your Question: Organization ID vs Tenant ID

You're architecturally correct — the system uses tenants. However, checking the data, for all active members `organization_id == tenant_id` (both point to the root org). The existing SELECT policies on `offer_letters` already use `m.organization_id = offer_letters.organization_id` and work fine. So the stored value is correct; it's just named `organization_id` instead of `tenant_id`.

Renaming the column would be a larger refactor (migration, code changes, existing data). For now, the pragmatic fix is to add the missing write policies using the same pattern as the working SELECT policies, plus `check_org_hierarchy_role_access` for hierarchy support (so tenant admins can manage offers in child org contexts too).

## The Actual Fix

The 403 error happens because `offer_letters` has **zero** INSERT/UPDATE/DELETE policies. We need a database migration to add them.

### SQL Migration

```sql
-- INSERT: org members with recruiter+ role can create offer letters
CREATE POLICY offer_letters_insert_policy
  ON public.offer_letters FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND check_org_hierarchy_role_access(organization_id, 'recruiter')
  );

-- UPDATE: org members with recruiter+ role can update offer letters
CREATE POLICY offer_letters_update_policy
  ON public.offer_letters FOR UPDATE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'recruiter'))
  WITH CHECK (check_org_hierarchy_role_access(organization_id, 'recruiter'));

-- DELETE: org admins only
CREATE POLICY offer_letters_delete_policy
  ON public.offer_letters FOR DELETE
  TO authenticated
  USING (check_org_hierarchy_role_access(organization_id, 'admin'));
```

This uses `check_org_hierarchy_role_access` which:
- Validates the user is an active member
- Supports parent-to-child org hierarchy access
- Implements role inheritance (admin inherits recruiter permissions)

### No Code Changes Needed

The `OfferComposerBody` already sets `created_by: user?.id` in the payload, which satisfies the INSERT policy's `created_by = auth.uid()` check.

## Files Changed
- 1 database migration (new RLS policies)

