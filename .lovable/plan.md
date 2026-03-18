

# Fix: "View Full Profile" Button Not Navigating

## Root Cause

When the button is clicked, two things happen simultaneously:
1. `navigate('/candidates?openCandidate=...')` — tries to go to the candidates page
2. `onOpenChange(false)` — triggers `updateCandidateUrl(null)` in `JobDetail.tsx`, which calls `setSearchParams(...)`, overwriting the navigation

The `setSearchParams` call wins because it runs after `navigate`, replacing the URL back to the current job page.

## Fix

In `CandidateProfileSheet.tsx` (~line 924), reverse the order and use a small delay or simply navigate without calling `onOpenChange`. Since navigating away from the page will unmount the sheet anyway, we don't need to explicitly close it.

**File: `src/components/candidates/CandidateProfileSheet.tsx`** (line ~924)

Change the click handler to only call `navigate()` — do not call `onOpenChange(false)`:

```tsx
onClick={() => {
  navigate(`/candidates?openCandidate=${candidate.id}`);
}}
```

The sheet will unmount naturally when the route changes from `/jobs/...` to `/candidates`.

