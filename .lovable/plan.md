## Bug
In **Edit posting → Application form**, toggling a custom question from Optional → Required (or vice versa) replaces the user-typed label with the default placeholder label (e.g., "New short text question"). The same flow inside the **Job Wizard** works because the wizard keeps state in memory; the posting sheet persists through a diff-based adapter.

## Root cause
`src/components/jobs/postings/SheetApplicationFormBuilder.tsx` is a diff adapter:

- `ApplicationFormBuilder` is fully controlled — every row mutation (add / rename / toggle required / reorder / delete / config) calls `onChange(nextArray)` with the entire array.
- `handleChange` then diffs `lastRef.current` (previous snapshot) vs `next` to decide whether to call `addCustomField`, `updateField`, `deleteField`, or `reorderFields`.
- `lastRef.current` is refreshed inside a `useEffect` on `combined`, i.e., **one render late**.
- When the user adds a question, the row is created with a default label. They type the real label, then click "Required". Between the rename-onChange and the toggle-onChange, `lastRef` is still the pre-rename snapshot, and `combined` (built from the optimistic `posting` state) hasn't always been refreshed yet. The diff for the toggle click can therefore:
  - See `next` carrying the stale default label (because the toggle was clicked before React re-rendered with the renamed `combined`), and
  - Issue an `updateField` with `is_required` only — but the user-visible label was already "Custom label", so when `fetchFields` returns the latest row, the UI snaps back to whatever the DB last received.
- The transient-id → DB-id swap during `addCustomField` makes this worse: a rename committed against the transient id is silently dropped, then the toggle persists `is_required` against the DB row whose label is still the default.

The wizard path doesn't hit this because it stores `AppField[]` directly in component state with no diff/refetch round-trip.

## Fix
Stop diffing. Give `ApplicationFormBuilder` optional granular callbacks and have the posting-sheet adapter wire each callback straight to the matching `useJobPostingFields` mutation. The wizard keeps the existing controlled-array path unchanged.

### Files to change

1. **`src/components/jobs/postings/ApplicationFormBuilder.tsx`**
   - Extend props with optional handlers: `onAddSmart`, `onAddBasic`, `onAddFromLibrary`, `onRenameField`, `onToggleRequired`, `onRemoveField`, `onUpdateFieldConfig`, `onReorderFields`.
   - Inside `addSmart`, `addBasic`, `addFromLibrary`, `toggleRequired`, `removeField`, `renameField`, `updateConfig`, and the DnD `onDragOver`, prefer the granular handler when supplied; fall back to the current `onChange(next)` behavior otherwise. This keeps `JobPostingStep` (wizard) working unchanged.
   - No visual changes.

2. **`src/components/jobs/postings/SheetApplicationFormBuilder.tsx`**
   - Remove the `handleChange` diff and the `lastRef` machinery.
   - Pass granular handlers that call `addCustomField`, `addFieldFromLibrary`, `updateField(id, { field_label })`, `updateField(id, { is_required })`, `updateField(id, { field_config })`, `deleteField`, and `reorderFields` directly.
   - Keep the core-field synthesis and the read-only guard exactly as today.

3. **`src/hooks/useJobPostingFields.ts`** (small hardening, no behavior change for callers)
   - `updateField` already does optimistic `setFields` — leave as is.
   - In `addCustomField`, also return the inserted row so the adapter can reference the new DB id if needed (purely for safety; the new adapter no longer needs id reconciliation because rename targets the DB id directly).

### Out of scope
- No DB schema changes.
- No changes to `JobPostingStep.tsx` (wizard).
- No visual/UX changes — only the data wiring inside Edit posting.

### Verification
- Edit posting → add a custom "Short text" question → type a custom label → toggle Required → label is preserved.
- Toggle Required → Optional → Required repeatedly → label unchanged.
- Rename, then reorder, then toggle required → all three persist independently.
- Wizard Step 4 still adds/renames/toggles correctly (unchanged code path).
