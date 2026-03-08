

# Add Edit Button to Independent Candidate Profile Sheet

## Change

**File**: `src/components/candidates/IndependentCandidateProfileSheet.tsx`

Add an "Edit" button in the action row (around line 261), alongside the existing "Add to Pipeline" and "Enrich from LinkedIn" buttons. It will be gated behind `canEditCandidates` permission and open the existing `CandidateFormSheet` (already imported and wired up at line 29/69).

```tsx
{candidate && canEditCandidates && (
  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
    <Edit className="h-4 w-4" />
    Edit
  </Button>
)}
```

The `Edit` icon is already imported (line 19), `editOpen` state already exists (line 69), and the `CandidateFormSheet` is already rendered somewhere in the component. No new dependencies or state needed — just placing the button in the visible action row.

