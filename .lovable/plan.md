

# Auto-Open Filter Sections When Saved Search Has Data

## Problem

When selecting a saved search, the `editableCriteria` IS being populated correctly from `currentProject.search_criteria`. However, all `CollapsibleSection` components in `FindFilterPanel` default to collapsed (`defaultOpen = false`), so the user sees empty-looking filters even though the data is there behind closed sections.

## Fix

**`src/components/sourcing/FindFilterPanel.tsx`**

Change `CollapsibleSection` to accept a `forceOpen` prop (or derive open state from whether the section has data). The simplest approach: make sections auto-open when their corresponding criteria array is non-empty.

For each section, pass `defaultOpen` based on whether criteria has values:

```tsx
<CollapsibleSection label="Job Titles" icon={Briefcase} defaultOpen={(c.title_keywords?.length ?? 0) > 0}>
<CollapsibleSection label="Keywords" icon={Tag} defaultOpen={(c.keywords?.length ?? 0) > 0}>
<CollapsibleSection label="Locations" icon={MapPin} defaultOpen={(c.locations?.length ?? 0) > 0}>
<CollapsibleSection label="Seniority" icon={TrendingUp} defaultOpen={(c.seniorities?.length ?? 0) > 0}>
// ...etc for all sections
```

But since `CollapsibleSection` uses `useState(defaultOpen)` internally, changing the prop after mount won't re-open it. So we also need to update `CollapsibleSection` to respond to `defaultOpen` changes:

```tsx
function CollapsibleSection({ label, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  
  // Sync open state when defaultOpen changes (e.g. saved search loaded)
  useEffect(() => {
    if (defaultOpen) setOpen(true)
  }, [defaultOpen])
  
  // ...rest unchanged
}
```

This way, when a saved search loads and populates criteria, sections with data auto-expand so the user sees the populated filters immediately.

## Files

| File | Change |
|------|--------|
| `src/components/sourcing/FindFilterPanel.tsx` | Add `useEffect` to `CollapsibleSection` to sync open state; pass data-aware `defaultOpen` to each section |

