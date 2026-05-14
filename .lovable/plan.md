## Problem

On `/jobs/:id/candidates/:cid`, the tab content (Job overview, Resume, Scorecards, etc.) doesn't scroll. The hero + stage strip sit at the top and the rest is cut off.

## Root cause

In `CandidateProfileSheet.tsx`:

- Line 1066–1070: outer wrapper is `h-[100dvh] flex flex-col overflow-hidden` when `asPage`.
- Line 1071: inner row wrapper is `flex w-full` for `asPage` — **missing `flex-1 min-h-0`**.
- Line 1088: main column is `flex-1 flex flex-col min-w-0` — **missing `min-h-0`**.

Because those two intermediate flex containers don't constrain their height, the inner scroll region at line 1164 (`flex-1 min-h-0 overflow-y-auto`) never gets a bounded height, so it grows with content and the page is clipped by the outer `overflow-hidden` instead of scrolling.

## Fix

Two small className tweaks in `src/components/candidates/CandidateProfileSheet.tsx`:

1. Line 1071 — add `flex-1 min-h-0` to the `asPage` variant:
   ```
   asPage ? "flex w-full flex-1 min-h-0" : "flex h-full w-full"
   ```
2. Line 1088 — add `min-h-0`:
   ```
   <div className="flex-1 flex flex-col min-w-0 min-h-0">
   ```

Both are needed for the existing `flex-1 min-h-0 overflow-y-auto` scroll container at line 1164 to actually become scrollable inside the fixed-viewport (`h-[100dvh]`) page layout.

## Out of scope

No changes to the sheet variant (`asPage=false`), tab structure, hero, or any business logic.

## Verification

Reload `/jobs/:id/candidates/:cid`, switch through Job overview / Resume / Scorecards / Activity / Comments — each long tab should scroll inside the content area while hero + stage strip remain visible above.
