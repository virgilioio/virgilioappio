

# Fix: Public Job Posting "About" + Application Form Save Button

## Issue 1: "About the Company" Not Visible on Public Job Postings

### Problem
The `tenants` table has RLS enabled but no policy allowing anonymous (unauthenticated) access. When candidates view a public job posting at `/p/:slug`, the query to fetch `tenants.about` silently returns nothing.

### Solution
Add a narrow RLS policy allowing anonymous SELECT on tenants rows only when that tenant has at least one active job posting (meaning they've opted into public visibility).

```sql
CREATE POLICY tenants_public_read_for_postings ON public.tenants
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.tenant_id = tenants.id
        AND jp.status = 'active'
    )
  );
```

No frontend code changes needed -- the query in `PublicJobPosting.tsx` already fetches `tenants.about` correctly; it's just blocked by RLS.

---

## Issue 2: Application Form Save Button Not Obvious

### Problem
The `PostingFieldsBuilder` component (the "Application Form" tab when editing a job posting) already has a Save button, but it only appears **conditionally** when `hasChanges` is true, and it's positioned inside the "Form Fields" card -- easy to miss. Users may add or edit fields and not realize they need to scroll up to save, or not notice the button appearing.

### Solution
Move the Save button out of the "Form Fields" card and place it as a sticky footer at the bottom of the Application Form tab content, so it's always visible when there are unsaved changes.

### File Changed
`src/components/jobs/postings/PostingFieldsBuilder.tsx`

- Remove the save button from inside the first `CardContent` (lines 429-441)
- Add a sticky footer div at the very end of the component's root `div`, outside both cards, that renders when `hasChanges && !readOnly`
- Style it with `sticky bottom-0 bg-background border-t p-4` so it stays pinned at the bottom of the sheet's scrollable area
- Add a "Discard" button alongside "Save Changes" to let users reset their pending changes

### Updated UI (bottom of the component)
```
[Form Fields Card]
[Add Field Card]
---------- sticky footer ----------
[Discard]              [Save Changes]
------------------------------------
```

## Files Modified

| File | Change |
|------|--------|
| New migration | Add `tenants_public_read_for_postings` RLS policy |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Move Save to sticky footer + add Discard button |

## Risk Assessment

- **Very low risk**: Additive RLS policy scoped narrowly; UI change is cosmetic repositioning of an existing button
