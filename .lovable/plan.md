

# Fix: CSV Import Dialog Scroll Issue

The mapping step content area uses `overflow-hidden` on line 129 which clips the content. The `ScrollArea` on line 131 has `max-h-[250px]` which should allow scrolling within the mapping list, but the outer container's `overflow-hidden` combined with the dialog's `max-h-[85vh]` may be conflicting.

The fix: wrap the entire mapping step content (column mapping + preview) in a single `ScrollArea` with proper height, replacing the current `overflow-hidden` container. This ensures the user can scroll through all mapped columns and the preview table.

## Change

**File**: `src/components/candidates/CSVImportDialog.tsx`

Line 129: Change the outer wrapper from `overflow-hidden` to use `overflow-y-auto` with a proper max height, and increase the column mapping `ScrollArea` max height to accommodate more fields:

```tsx
// Line 129: change overflow-hidden to overflow-y-auto with calculated height
<div className="flex-1 overflow-y-auto flex flex-col gap-4 max-h-[calc(85vh-220px)]">
```

Also increase the column mapping `ScrollArea` max-h from `250px` to `400px` (line 131) so more fields are visible before needing to scroll.

Single file, two small class changes.

