

# Fix: Offer Forms RLS + Infinite Loop

## Issues Found

### 1. RLS policies block `platform_admin` users
The `offer_forms` and `offer_form_fields` RLS policies only allow `workspace_owner` via `user_is_workspace_owner_in_tenant()`. Your user is `platform_admin`, which is not covered. The pattern used everywhere else in the codebase is `get_user_type_secure() = 'platform_admin' OR ...`.

### 2. Infinite re-render loop from duplicate hook instances
`OfferFormSheet` creates its own `useOfferForms(context)` instance, separate from the one in `OfferFormsManager`. Both fire `fetchForms()` on mount. When the RLS error triggers a toast, the error state cascades through React re-renders between the two independent hook instances. The sheet should receive `createForm`/`updateForm`/`forms` as props from the parent instead of instantiating its own hook.

## Fix Plan

### Migration: Add platform_admin to RLS policies
Add `platform_admin` bypass to all four RLS policies on `offer_forms` and `offer_form_fields`:

```sql
-- offer_forms: allow platform_admin full access
CREATE POLICY "offer_forms_platform_admin" ON public.offer_forms
  FOR ALL USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');

-- offer_form_fields: same
CREATE POLICY "offer_form_fields_platform_admin" ON public.offer_form_fields
  FOR ALL USING (get_user_type_secure() = 'platform_admin')
  WITH CHECK (get_user_type_secure() = 'platform_admin');
```

### `OfferFormSheet.tsx`: Remove duplicate hook, accept props
Instead of calling `useOfferForms(context)` internally, accept `forms`, `createForm`, and `updateForm` as props from the parent `OfferFormsManager`.

### `OfferFormsManager.tsx`: Pass hook results to sheet
Pass the hook's `forms`, `createForm`, `updateForm` down to `OfferFormSheet` as props.

## Files

| File | Action |
|------|--------|
| New migration SQL | Add `platform_admin` RLS policies for both tables |
| `src/components/settings/templates/OfferFormSheet.tsx` | Remove `useOfferForms` hook, accept props |
| `src/components/settings/OfferFormsManager.tsx` | Pass hook data as props to `OfferFormSheet` |

