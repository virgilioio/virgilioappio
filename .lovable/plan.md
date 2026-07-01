## Problem
The right context pane (Snapshot + Pipeline stepper + Quick actions) is built, but it's not showing. `ContextPane.tsx` uses `hidden xl:flex`, which only reveals it at ≥1280px. Inside the Lovable editor, the preview iframe is narrower than the full browser window, so the pane is being hidden even when the outer window looks wide.

## Fix
1. **`src/components/chat/ContextPane.tsx`** — drop the `xl` gate so the right pane is visible whenever the Chat module has room. Change `hidden xl:flex` → `hidden lg:flex` (shows at ≥1024px), matching the middle pane's usable width in the editor and in production.
2. **`src/pages/Chat.tsx` (or the Chat layout wrapper)** — confirm the parent flex row doesn't cap the middle pane in a way that squeezes the 304px right rail; if it does, allow the right rail to sit alongside without pushing the composer.
3. Sanity-check the three inner blocks render with real data (no silent early-return when `candidate`/`job` joins are null): render the Snapshot with graceful fallbacks ("—") instead of hiding the whole pane.

## Verification
- Load `/chat/:threadId` in the preview at the current editor width and confirm the 304px right rail appears with the candidate snapshot, pipeline stepper, and quick actions.
- Resize to a narrow window (<1024px) and confirm the pane hides cleanly without breaking the middle thread layout.

No design tokens, copy, or business logic change — this is a visibility/breakpoint fix so the already-built right pane actually shows.