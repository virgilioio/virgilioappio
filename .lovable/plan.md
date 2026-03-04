

# Suppress Toast Spam During Drag-and-Drop Reorder

## Problem

When reordering fields via drag-and-drop, the `handleDragEnd` function calls `updateField` in a loop for every field whose `display_order` changed. Each call triggers a "Form field updated successfully" toast — so dragging one field in a list of 8 can fire 7 toasts simultaneously.

This affects both:
- **`OfferFormFieldsManager`** — calls `useOfferFormFields().updateField` in a loop
- **`useApplicationFields().updateField`** — same pattern (used by job posting fields)

## Solution

Add a `silent` option to the `updateField` functions in both hooks so callers can suppress the toast. The drag-and-drop handlers will pass `silent: true`, then show a single toast after all updates complete.

### 1. `src/hooks/useOfferFormFields.ts` — Add silent option

Add an optional `options?: { silent?: boolean }` parameter to `updateField`. When `silent` is true, skip the success toast and the `fetchFields()` call (the caller will handle it).

### 2. `src/hooks/useApplicationFields.ts` — Add silent option

Same change — add `silent` option to `updateField` to skip toast and refetch.

### 3. `src/components/settings/OfferFormFieldsManager.tsx` — Batch reorder

Update `handleDragEnd` to pass `{ silent: true }` for each reorder update, then call `refetchFields()` once and show a single "Fields reordered" toast (or no toast at all — reordering is visually obvious).

### 4. `src/components/jobs/postings/PostingFieldsBuilder.tsx` — Verify

This component only updates local state on drag (no DB calls in the loop), so no change needed. Just confirm.

## Files changed
- `src/hooks/useOfferFormFields.ts` — silent option on `updateField`
- `src/hooks/useApplicationFields.ts` — silent option on `updateField`
- `src/components/settings/OfferFormFieldsManager.tsx` — use silent + single toast

