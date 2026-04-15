

# Move Project Controls to Top Header Bar

## What Changes

Move the collaborators button, Link to Job, Gio's interpretation, Refresh, and three-dot dropdown menu from their current positions (inside `SourcingProjectView` and `CandidatesTab`) up to the top header bar in `Find.tsx` — the same row where the Saved Search selector chip sits. These controls only appear when a project is loaded.

## Current Layout
```text
┌─────────────────────────────────────────────┐
│ [Searches ▾]                                │  ← top bar (Find.tsx)
├─────────────────────────────────────────────┤
│ [+ Collaborators avatars]                   │  ← SourcingProjectView
├─────────────────────────────────────────────┤
│ [Chat] [Candidates] [Saved] [Archived]      │  ← tabs
├─────────────────────────────────────────────┤
│ [Link to Job] [Gio's interp]  [Refresh] [⋯] │  ← CandidatesTab toolbar
```

## Target Layout
```text
┌──────────────────────────────────────────────────────────────┐
│ [Searches ▾] [+👤] [Link to Job] [Gio's interp]  [⟳] [⋯]  │  ← top bar
├──────────────────────────────────────────────────────────────┤
│ [Chat] [Candidates] [Saved] [Archived]                       │  ← tabs
├──────────────────────────────────────────────────────────────┤
│ (candidate table — no toolbar row)                           │
```

## Implementation

### 1. Lift action props and state to `Find.tsx`

`Find.tsx` already has `currentProject`. Add the necessary action handlers (refresh, archive, delete, visibility toggle, link-to-job) and dialog state that currently live in `SourcingProjectView` and `CandidatesTab`. These will be passed down or used directly in the header bar.

### 2. Create a `SourcingProjectActions` component

A new component rendered in the top header bar of `Find.tsx` (next to `SavedSearchSelector`) that contains:
- `SourcingProjectCollaborators` (the "+" avatar row)
- Link to Job button / linked job label
- Gio's interpretation button
- Refresh button
- Three-dot dropdown (visibility toggle, create job from spec, archive, delete)

This component receives `currentProject`, action callbacks, and `isRefreshing` as props.

### 3. Remove controls from inner components

- **`SourcingProjectView`**: Remove the collaborators row (lines 339-342)
- **`CandidatesTab`**: Remove the entire toolbar row (lines 86-200ish), keeping only the candidate table. Remove the associated dialog state and props that move up.

### 4. Update `Find.tsx` header bar

```tsx
<div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
  <SavedSearchSelector ... />
  {mode === 'project' && currentProject && (
    <SourcingProjectActions
      project={currentProject}
      projectId={projectId}
      isRefreshing={isRefreshing}
      onRefresh={handleRefresh}
      ... 
    />
  )}
</div>
```

### Files Modified
- `src/pages/Find.tsx` — add action handlers, render `SourcingProjectActions` in header
- `src/components/sourcing/SourcingProjectActions.tsx` — **new** component with all controls
- `src/components/sourcing/SourcingProjectView.tsx` — remove collaborators row, expose refetch via callback
- `src/components/sourcing/CandidatesTab.tsx` — remove toolbar row and associated props/state

