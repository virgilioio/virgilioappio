## Goal

Make clicking a candidate from anywhere in the app (Candidates list, global search bar, search dialog, deep-link URLs) open the **redesigned full page** at `/candidates/:candidateId` — instead of the legacy `IndependentCandidateProfileSheet` drawer.

The redesigned page (`src/pages/IndependentCandidateProfile.tsx`) already exists and is imported in `App.tsx`, but no route renders it — `/candidates/:candidateId` currently redirects to `/candidates?openCandidate=…`, which re-opens the old drawer. That's why you still see the old UI.

## Changes

### 1. `src/App.tsx` — wire up the redesigned page

- Remove the `CandidateRedirect` component.
- Change the route so `/candidates/:candidateId` renders `<IndependentCandidateProfile />` directly, wrapped in the same `AuthGate` + `PermissionGate` (`canViewCandidates`) used by `/jobs/:jobId/candidates/:candidateId`.

### 2. `src/pages/Candidates.tsx` — navigate instead of opening a drawer

- `handleOpenCandidate(id)` → `navigate('/candidates/' + id)` (preserve any saved‑view / list state in the URL so back‑button returns to the same list view).
- Remove the `?openCandidate=` auto‑open `useEffect`, the `profileId` / `profileOpen` state, and the `<UniversalCandidateProfileSheet>` render block.
- Drop the now‑unused `UniversalCandidateProfileSheet` import.

### 3. `src/components/search/GlobalSearchBar.tsx` and `src/components/search/SearchResultsDialog.tsx`

- On candidate result click: `navigate('/candidates/' + result.id)` and close the popover/dialog.
- Remove the local `selectedCandidateId` / `sheetOpen` state and the embedded `<IndependentCandidateProfileSheet>`.
- Drop the `IndependentCandidateProfileSheet` import from both files.

### 4. Leave alone

- `UniversalCandidateProfileSheet` still handles the `job`, `apollo`, and `pdl` contexts — keep it; only the `independent` branch becomes unreachable through these entry points. Don't delete the file (sourcing / Apollo / PDL still rely on it). The old `IndependentCandidateProfileSheet` component file can stay too (no usages after this change, but deleting it is out of scope for a UI request — flag for cleanup later).
- `/jobs/:jobId/candidates/:candidateId` (in‑job page) is unchanged.
- `useCandidateResolver`, hooks, and data layer are unchanged.

## Outcome

Clicking a candidate on `/candidates`, in the global search bar, or in the search dialog opens the new full‑page profile. Direct links to `/candidates/:candidateId` also land on the redesigned page. Browser back returns to the list. The job‑scoped profile and sourcing/Apollo/PDL previews are unaffected.
