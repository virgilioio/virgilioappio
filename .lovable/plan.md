

# Fix Placeholder Mapping: Organization vs Tenant Name

## Problem

`{{organization.name}}` currently resolves to the **department/job folder** name (from the `organizations` table), not the **workspace/company** name (from the `tenants` table). This is incorrect for candidate-facing emails like "Thank you for applying at {{organization.name}}" -- candidates expect to see the company name, not an internal department label.

## Solution

1. **Keep `{{organization.name}}` but fix it to resolve to `tenants.name`** in candidate-facing contexts (confirmation emails). This is what users intuitively expect "organization" to mean.
2. **Add a `{{department.name}}` placeholder** for when users actually want the job folder/department name.
3. Update resolution logic in `public-submit-application` and the `PlaceholderHelper` UI.

## Changes

### 1. Fix `public-submit-application/index.ts` (confirmation email block)

Replace the `organizations` table lookup (lines 700-706) with a `tenants` table lookup:

```
// Before (wrong): fetches department name
const { data: org } = await supabase
  .from('organizations')
  .select('name')
  .eq('id', job.organization_id)

// After (correct): fetches workspace/tenant name
const { data: tenant } = await supabase
  .from('tenants')
  .select('name')
  .eq('id', posting.tenant_id)
```

Also add `{{department.name}}` resolution by keeping the existing organizations lookup as an optional secondary source.

### 2. Update `PlaceholderHelper.tsx`

- Rename `{{organization.name}}` description to "Company / Workspace name" (so it's clear this is the tenant)
- Add `{{department.name}}` placeholder described as "Department / Job folder name"
- Remove `{{organization.default_currency}}` or map it to the correct source

### 3. Update `templateUtils.ts`

- Add `department.name` to `PlaceholderData` interface and `PLACEHOLDER_OPTIONS`
- Update `buildPlaceholderData` to accept tenant name

### 4. Update default template in `ConfirmationEmailAutomation.tsx`

No change needed -- `{{organization.name}}` is already used in the default subject/body, and it will now correctly resolve to the tenant (company) name.

## Files to modify
- `supabase/functions/public-submit-application/index.ts` -- fix tenant lookup, add department resolution
- `src/components/settings/PlaceholderHelper.tsx` -- fix descriptions, add department placeholder
- `src/utils/templateUtils.ts` -- add department.name to interface and options

## Impact
- Confirmation emails will now correctly show "Thank you for applying at Acme Corp" instead of "Thank you for applying at Engineering"
- Power users who need department names can use `{{department.name}}`
- No breaking changes to existing templates (the placeholder key stays the same)

