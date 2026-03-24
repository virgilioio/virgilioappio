

# Fix Bulk Import Job Selection

## Problems Found

### Bug 1: Selection doesn't work — label-based matching in SearchableSelect

`SearchableSelect` (line 108) sets `CommandItem value={option.label}` — the **display label**, not the unique ID. The `onSelect` callback then does `options.find(opt => opt.label.toLowerCase() === selectedLabel.toLowerCase())` to reverse-lookup the value.

This breaks when multiple options share the same label (e.g. two jobs titled "Software Engineer"). The cmdk library also **deduplicates items by their `value` prop**, so items with identical labels get merged/hidden — explaining the selection failure.

### Bug 2: Jobs listed as duplicates — no status filter

`MinimizableBulkUploadDialog` uses `useJobs()` which returns **all** jobs (open, draft, closed, archived). Per the project's own convention (documented in memory), this dropdown should only show `open` and `draft` jobs. The unfiltered list likely shows the same logical job in multiple states, or simply too many irrelevant entries.

## Fix

### 1. `src/components/ui/searchable-select.tsx` — Use unique value for CommandItem

Change CommandItem to use `option.value` (the UUID) instead of `option.label` for matching. Add a `keywords` prop with the label so search still works by text.

```tsx
// Line 106-116: Before
<CommandItem
  key={option.value}
  value={option.label}
  onSelect={(selectedLabel) => {
    const matchedOption = options.find(opt => opt.label.toLowerCase() === selectedLabel.toLowerCase())
    if (matchedOption) {
      onValueChange(matchedOption.value === value ? "" : matchedOption.value)
    }
    setOpen(false)
  }}
>

// After
<CommandItem
  key={option.value}
  value={option.value}
  keywords={[option.label]}
  onSelect={(selectedValue) => {
    onValueChange(selectedValue === value ? "" : selectedValue)
    setOpen(false)
  }}
>
```

This ensures each item is unique (by UUID) and selection maps directly to the correct option. The `keywords` prop lets cmdk still search/filter by the display label.

### 2. `src/components/candidates/MinimizableBulkUploadDialog.tsx` — Filter to active jobs only

```tsx
// Line 84-87: Before
const jobOptions = jobs?.map((job) => ({
  value: job.id,
  label: job.title,
})) || [];

// After
const jobOptions = jobs
  ?.filter((job) => job.status === 'open' || job.status === 'draft')
  .map((job) => ({
    value: job.id,
    label: job.title,
  })) || [];
```

## Files

| File | Change |
|------|--------|
| `src/components/ui/searchable-select.tsx` | Use `option.value` + `keywords={[option.label]}` for CommandItem matching |
| `src/components/candidates/MinimizableBulkUploadDialog.tsx` | Filter jobs to `open`/`draft` only |

## What stays untouched
- `useJobs` hook — no changes to data fetching
- All other SearchableSelect consumers — the fix is backward-compatible (value was already unique UUIDs in all usages)
- No business logic, permissions, or layout changes

