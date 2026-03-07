

# Fix: CSV Import Dialog Scroll

## Problem

The mapping step has nested scroll containers (`overflow-y-auto` on the outer div + `ScrollArea` with `max-h-[400px]` inside). Radix ScrollArea needs an explicit height constraint from its parent to work, but the flex layout with `calc()` max-height isn't reliably providing one. The result: content overflows and becomes unreachable.

## Fix

**File**: `src/components/candidates/CSVImportDialog.tsx`

1. Remove the outer `overflow-y-auto` div wrapper for the mapping step
2. Wrap the entire mapping content (warning + column mapping + name error + preview) in a single `ScrollArea` with `className="flex-1 min-h-0"`
3. Remove the inner `ScrollArea` around column mapping rows — it becomes redundant
4. Keep the preview `ScrollArea` for horizontal scroll only
5. On `DialogContent`, add `overflow-hidden` to prevent double scrollbars

This gives the ScrollArea a proper flex-constrained height from the dialog's `max-h-[85vh]` layout, making all content scrollable within one unified scroll container.

