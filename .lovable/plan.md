

# Fix "New" Badge: Never Clears + Restyle to Match Badge Guidelines

## Problem 1: "New" badge never removed in Application Review

**Root cause**: In `CandidateTable.tsx`, when `onRowClick` is provided, `handleLinkClick` (line 129) calls `onRowClick` but skips `markCandidateAsViewed`. Since Application Review always passes `onRowClick`, clicking a candidate never marks them as viewed — the "New" badge persists forever.

**Fix**: Add `markCandidateAsViewed(candidate.id)` inside the `onRowClick` branch of `handleLinkClick`.

```typescript
const handleLinkClick = (e: React.MouseEvent, candidate: CandidateTableCandidate) => {
  if (onRowClick) {
    e.preventDefault()
    e.stopPropagation()
    markCandidateAsViewed(candidate.id)  // ← add this line
    onRowClick(candidate.id)
  } else {
    handleCandidateClick(candidate)
  }
}
```

## Problem 2: "New" badge doesn't follow badge visual guidelines

Currently uses a red `destructive` Badge with custom classes. Should follow the Smart Field pastel pattern.

**Fix**: Update `new-badge.tsx` to use a pastel-style badge (e.g., emerald/green tint for "new" items):

```
border-emerald-200 bg-emerald-100 text-emerald-700
```

With a subtle sparkle or dot icon for polish.

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/CandidateTable.tsx` | Add `markCandidateAsViewed` call in the `onRowClick` branch |
| `src/components/ui/new-badge.tsx` | Restyle badge to Smart Field pastel pattern |

