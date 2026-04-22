

## Mobile pipeline: match Notion's edge-to-edge feel

### Diagnosis (what's missing vs Notion)
Side-by-side, the issue isn't height — it's **wrapper bloat and width**. Notion shows the stage column nearly edge-to-edge with breathing room only at the very edge. Ours wraps the kanban in:

1. An outer **`Card` with border + rounded corners** (the empty white frame visible around the stage in your screenshot)
2. A `CardContent` 
3. A scroll wrapper with `p-layout-md` (~24px padding on every side)
4. PipelineOverview's own internal stage `Card` using `w-[calc(100vw-3rem)]`

That's **3 nested containers + 24px padding** before the stage card even renders. Combined with the stage card's own `calc(100vw - 3rem)` width, the stage ends up sitting inside a visible empty frame with awkward gaps top/left/right — exactly what your screenshot shows.

Notion has no outer card. The columns sit directly in the scroll viewport, full width, with just enough side padding to breathe.

### Fix — strip the mobile wrapper card and reclaim width

**File: `src/pages/JobDetail.tsx`** (both pipeline branches: ~lines 989–1132 and ~1527+)

1. **Remove the outer `Card` shell on mobile** for the main Pipeline Overview card. On mobile only, render its children without the `Card`/`CardContent` wrapper so the kanban sits directly inside the `TabsContent` flex column. Keep the `Card` wrapper for `sm:` and up (desktop unchanged).
   - Implementation: split the JSX so the mobile branch returns just the scroll wrapper + PipelineOverview, and the desktop branch keeps the full `Card` > `CardHeader` > `CardContent` structure. Or wrap the `Card` in `hidden sm:flex` and add a parallel `sm:hidden` plain `<div className="flex-1 min-h-0 flex flex-col">` for mobile.

2. **Reduce mobile padding** on the scroll wrapper from `p-layout-md` to `px-3 py-3` (12px) so the stage column gets ~24px more horizontal room. Keep `pb-[calc(env(safe-area-inset-bottom,0px)+96px)]` for bottom-nav clearance.

3. **Tighten the section selector card spacing** — change its wrapper Card from `mb-4` to `mb-3` and the `CardHeader` from `py-3` to `py-2` so it doesn't dominate the top of the viewport. The selector should feel like a compact pill, not a hero card.

**File: `src/components/jobs/PipelineOverview.tsx`** (line ~671)

4. **Widen the stage column on mobile** from `w-[calc(100vw-3rem)]` to `w-[calc(100vw-1.5rem)]` so it uses the reclaimed horizontal space (matching Notion's edge-to-edge feel). Desktop `sm:w-72` stays untouched.

5. **Hide the empty filter chips wrapper on mobile entirely** — the existing `<div className="hidden sm:flex …">` already hides the Favorite chip, but the empty `div` still emits no markup so this is fine. Verify by also wrapping any sibling empty containers in `sm:` only.

### Result on 390×844
- Section selector becomes a compact 40px pill at top (not a 60px card)
- Stage column ("Final Candidate Review") spans **near-full viewport width** — no visible empty outer frame around it, matching Notion
- Candidate cards inside the stage are wider, not squeezed
- Vertical space is fully used by the kanban, no wasted top/bottom card chrome
- Desktop layout: completely unchanged (all chrome lives behind `sm:` breakpoint)

### Files touched
- `src/pages/JobDetail.tsx` — split mobile vs desktop wrapper, tighten spacing (both pipeline blocks)
- `src/components/jobs/PipelineOverview.tsx` — widen stage column on mobile

### Out of scope
- Desktop pipeline (untouched)
- Stage column visual design (header colors, badges — already fine)
- Candidate card internals
- The mobile section selector content (kept as-is, just tighter)

