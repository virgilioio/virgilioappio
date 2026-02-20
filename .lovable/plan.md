
## Root Cause: Vite Module Graph Cache Stale After Types Regeneration

The error "Failed to fetch dynamically imported module" for `Candidates.tsx` is **not a code bug** — all files and imports in the chain are syntactically correct and exist on disk. This is a classic Vite dev server issue.

### What Happened

During the previous fix session, the `src/integrations/supabase/types.ts` file was regenerated (it grew from its previous state to include the updated `get_candidate_activities` return type). When Vite's module graph has a large auto-generated file regenerated mid-session, it can leave the dynamic import manifest stale, causing any lazy-loaded route (like `const Candidates = lazy(() => import('./pages/Candidates'))`) to fail with this error — even though the file itself is perfectly valid.

### The Fix

Touch `src/pages/Candidates.tsx` with a trivial no-op change (add/remove a comment or blank line) to force Vite to re-hash the module and rebuild the dynamic import chunk. This is the standard solution for this class of Vite HMR cache staleness.

No logic changes are needed. The file will remain functionally identical.

### Technical Details

| Item | Status |
|------|--------|
| `src/pages/Candidates.tsx` | Valid — no syntax errors |
| `UniversalCandidateProfileSheet.tsx` | Valid — all imports resolve |
| `IndependentCandidateProfileSheet.tsx` | Valid — all imports resolve |
| `emailFormatUtils.ts` | Exists at `src/utils/emailFormatUtils.ts` |
| `src/integrations/supabase/types.ts` | Valid — recently regenerated, triggers cache stale |
| All referenced assets | Exist in `src/assets/` |

### Why This Is Not the 403 Error

The 403 error in `admin-operations` was a separate and already-fixed issue. The module fetch error is a frontend Vite cache problem unrelated to the edge function fix.

### Files Changed

- `src/pages/Candidates.tsx` — trivial touch to invalidate Vite module graph cache (no functional change)
