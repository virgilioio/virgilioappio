

# Show SavedSearchSelector on Find page in "new" mode

## Problem

The `SavedSearchSelector` lives inside `SourcingProjectView`, which only mounts when a `projectId` exists. On `/find` (new mode), there's no project view rendered, so the selector is invisible.

## Fix

**`src/pages/Find.tsx`**

Add the `SavedSearchSelector` to the Card header so it's always visible, regardless of mode. Place it above the content area inside the Card, before the `flex-1 min-h-0 overflow-hidden` div (around line 218).

```tsx
<Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
  {/* Always show SavedSearchSelector */}
  <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
    <SavedSearchSelector
      selectedProjectId={projectId ?? null}
      currentProject={currentProject}
      onSelectProject={(id) => navigate(`/find/${id}`)}
      onNewSearch={() => navigate('/find')}
    />
  </div>
  
  <div className="flex-1 min-h-0 overflow-hidden">
    {mode === 'new' && ( ... )}
    {mode === 'project' && ( ... )}
  </div>
</Card>
```

Then remove the duplicate `SavedSearchSelector` from `SourcingProjectView.tsx` (lines 355-363) to avoid showing it twice when a project is selected.

## Files

| File | Change |
|------|--------|
| `src/pages/Find.tsx` | Add `SavedSearchSelector` inside Card header, always visible |
| `src/components/sourcing/SourcingProjectView.tsx` | Remove the SavedSearchSelector row (lines 355-363) to avoid duplication |

