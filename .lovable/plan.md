## Goal

Surface the 7 mandatory application fields that already exist in the DB (and already render on every job post) inside **Settings > Recruiting > Application form**, as a locked read-only "Standard fields" section. No DB changes. No behavior changes on job posts.

## Why they're missing today

`src/hooks/useApplicationFields.ts` filters them out at the query level:

```ts
.eq('is_core_field', false)   // line ~46 — only returns custom fields
```

The 7 fields exist with `is_core_field = true`, `tenant_id = null`, and platform-owned `display_order` 1–8 (Resume, First Name, Last Name, Email, Phone, LinkedIn, Profile Summary). They are intentionally read-only across all tenants.

## Changes

### 1. `src/hooks/useApplicationFields.ts`
- Remove the `.eq('is_core_field', false)` filter so core platform rows are returned too.
- Keep the existing `tenant_id IS NULL OR tenant_id = <me>` scoping.
- Keep `source: 'platform' | 'tenant'` derivation.
- No changes to `createField` / `updateField` / `deleteField` / `copyPlatformTemplate`.

### 2. `src/components/settings/ApplicationFieldsManager.tsx`
- Split the loaded `fields` into three buckets:
  - `coreFields` = `source === 'platform' && is_core_field === true`, sorted by `display_order`.
  - `platformOptionalFields` = `source === 'platform' && is_core_field === false` (existing "Platform fields" copyables — unchanged).
  - `tenantFields` = `source === 'tenant'` (unchanged).
- Render a new **first** `<SpecCard>` titled **"Standard fields"** with description **"Always collected on every application. Required by the platform and can't be edited."**
  - One `<SpecRow>` per core field.
  - Layout matches the existing rows: `field_label` (Inter 12.5 / 500) + `field_name` mono mini-label + a `<SpecChip tone="gray">{field_type}</SpecChip>` + a `<SpecChip tone="purple">Required</SpecChip>` on the right.
  - No Edit, Delete, Copy, or toggle controls. No DnD.
- Keep the existing "Platform fields" card (optional copyables) and "My custom fields" card exactly as they are, in that order, below the new Standard card.
- Update the existing "Platform fields" card description to drop the now-redundant "Core fields (name, email, phone, resume) are always included." sentence (that information moves to the new card's description).

### 3. Context: `platform-defaults` view
- In `context === 'platform-defaults'`, also render the Standard card at the top so platform admins see the same row, still read-only in this UI (core-field editing stays out of this screen).

## Out of scope
- Per-tenant required/optional toggles on core fields.
- Hiding or reordering core fields per tenant.
- Any change to the public application page rendering (it already reads these fields from `application_fields` + the per-posting overrides).
- Any schema change.

## Verification
- Settings > Recruiting > Application form shows a "Standard fields" card listing exactly: Resume/CV, First Name, Last Name, Email Address, Phone Number, LinkedIn Profile, Profile Summary — in that order, each with a "Required" chip and no actions.
- "Platform fields" card still shows Cover Letter + Salary Expectation rows with Copy.
- "My custom fields" card behavior unchanged (Add / Edit / Delete still work).
- Public job application page output is byte-identical to today.
