# Fix "Rendered more hooks" crash on Job Dashboard

## Root cause (confirmed)

The `dashboardCopyText` `useMemo` added for the copy icon sits **after** the `if (!data) return null;` early return in `src/components/jobs/JobBriefingTab.tsx` (return at line 707, memo at ~791). On first render `data` is `null`, so the memo never runs; when the briefing loads, the hook count changes and React throws error #310.

It also depends on values defined after that same early return:
- `const s = data.snapshot;` (line 709)
- `closestList` / `closestCount` (lines 712–717)
- `let projected = ...` (lines 747–789)

## Fix (one file: `src/components/jobs/JobBriefingTab.tsx`)

1. **Hoist the derived values above the early return**, null-safely:
   - `const s = data?.snapshot ?? null;`
   - `closestList` / `closestCount` computed with `s ? ... : 0`.
   - `projected` computed with a `!s` guard producing the existing "empty" tile shape, otherwise the current schedule logic unchanged.
   - Everything currently rendered below still uses the same variables — no markup changes.
2. **Move the `dashboardCopyText` useMemo up next to the existing `ranked`/`positive` memos** (before the loader/error returns at line 676), returning `''` when `!data || !s`. Same dependency list, same text output.
3. The early returns (`if (!data) return null;` etc.) stay where they are — all hooks now run unconditionally above them.

## Verification

- Build passes.
- Open a job dashboard with no cached briefing: narrated loader runs, then the dashboard renders without the hooks error.
- Open a job with a cached briefing: renders directly, copy button still copies the plain-text snapshot.
