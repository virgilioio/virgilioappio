# Fix: "Rendered more hooks than during the previous render" on candidate profile

## Root cause
In `src/pages/IndependentCandidateProfile.tsx`, the component has early returns for the loading and not-found states (around lines 260 and 280), but `useWhatsAppEnabled()` (line 420) — and possibly other hooks below those returns — only execute after the candidate data loads. React then sees a different number of hooks between renders and crashes. This is the same class of bug we just fixed in `JobDetail`.

## Fix
1. In `IndependentCandidateProfile.tsx`, hoist every hook call (`useWhatsAppEnabled` and any other hook currently below the early returns) above the loading / not-found returns, so all hooks run unconditionally on every render.
2. Keep the early returns themselves unchanged — only their position moves below the hook block.
3. Sweep the same file for any other hooks after conditional returns and reorder them the same way.
4. Also grep the codebase for the same pattern in nearby profile sheets/pages we touched recently (e.g. `CandidateProfileSheet.tsx`, `CandidateProfile.tsx`) and fix any matches.

## Verification
- Typecheck passes.
- Load the independent candidate profile page for an existing candidate (the route that crashed) and confirm no React #310 / hook-count error and the page renders normally, including while data is still loading.
