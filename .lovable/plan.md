## Goal

At narrow widget widths (small screens or a 1-span card on a tight grid), several analytics chart bodies render wider than their containing widget card. Fix the chart primitives and the widget body so content is always clipped/sized to the card.

## Root causes

1. **`WidgetFrame` body** (`src/components/analytics/widgets/WidgetFrame.tsx`)
   - Body wrapper is `flex-1 min-h-0` with no `min-w-0` and no `overflow-hidden`. A child SVG with a measured pixel width can push the card out before the `ResizeObserver` recalculates.

2. **`LineChart`** (`charts/LineChart.tsx`)
   - Renders `<svg width={w} height={height}>` where `w` comes from `ResizeObserver`. On the first paint, on container shrink, or in the brief window before RO fires, `w` keeps the previous larger value → SVG overflows. Also no `overflow-hidden` on the wrapper.

3. **`BarsChart`** (`charts/BarsChart.tsx`)
   - Fixed `w-[116px]` label column + `gap-3` + fixed `w-[52px]` value column. Below ~240px wide that already exceeds the card.

4. **`FunnelChart`** (`charts/FunnelChart.tsx`)
   - Same pattern: fixed `w-[110px]` label and `w-[42px]` conversion columns. Same overflow at narrow widths.

5. **`ColumnsChart`** (`charts/ColumnsChart.tsx`)
   - Uses `gap-2` between columns with `flex-1` items but no `min-w-0`/`overflow-hidden` — long category labels wrap and push height; numeric labels above can be wider than the column at narrow widths.

6. **`DonutChart`** (`charts/DonutChart.tsx`)
   - Fixed `size = 200` SVG + legend side-by-side. Below ~320px wide, SVG + legend overflow horizontally.

## Changes

### A. Widget body containment
- In `WidgetFrame.tsx`, change the body wrapper from `flex-1 min-h-0` to `flex-1 min-h-0 min-w-0 overflow-hidden`. This guarantees clipping even if a child momentarily over-measures.
- Also add `min-w-0` to the outer card flex column so it shrinks inside the grid.

### B. LineChart — make SVG fluid
- Drop the measured-pixel `width` approach. Render:
  - `<svg viewBox="0 0 {VIRTUAL_W} {height}" width="100%" height={height} preserveAspectRatio="none">` for the area/grid, with the curve drawn against a fixed virtual width (e.g. 600). Text labels (`fontSize`) are placed in a second SVG overlay using `preserveAspectRatio="xMinYMin meet"` OR rendered as HTML at percent x positions so they don't stretch.
- Simpler alternative we'll adopt: keep ResizeObserver but
  - initialise `w` to `0` and render nothing until measured (avoid first-paint overflow),
  - wrap in a `div.w-full.overflow-hidden`,
  - clamp `w` to `ref.current.clientWidth` on every observer tick.

### C. BarsChart / FunnelChart — fluid label & value columns
- Replace fixed pixel widths with responsive ones using `clamp` via inline style or Tailwind arbitrary values:
  - Label column: `w-[clamp(72px,28%,140px)]`.
  - Value/conv column: `w-[clamp(40px,16%,60px)]`.
- Add `min-w-0` to the bar track so flex can shrink.
- Wrap each chart root in `w-full overflow-hidden`.

### D. ColumnsChart
- Wrap root in `w-full overflow-hidden`.
- Add `min-w-0` to each column item; truncate value labels (`truncate max-w-full`).
- Cap inner SVG/column gap to `gap-1` when the parent is narrow (use `gap-1 sm:gap-2`).

### E. DonutChart — stack at narrow widths
- Wrap in a container with `flex flex-col @[280px]:flex-row items-center gap-4 w-full overflow-hidden` (use Tailwind container queries already enabled, otherwise fall back to `flex-col md:flex-row`).
- Make the SVG `max-w-full h-auto` and replace fixed `size={200}` with `min(size, containerWidth)` via a `ResizeObserver` (same hardened pattern as LineChart).
- Legend list gets `min-w-0 w-full`.

### F. Sanity pass
- Audit `TableViz` and `KpiChart` for the same fixed-width issues; add `min-w-0 overflow-hidden` wrappers there too if needed (no logic change).

## Out of scope
- No metric, data, or business-logic changes — purely presentational/responsive.
- No grid/breakpoint changes in `WidgetGrid`.

## Verification
- Resize the Analytics page from 1400 → 360 px and confirm no widget content extends past its card border, no horizontal scrollbar on the grid, no clipped numbers.
- Check Line, Bars, Columns, Funnel, Donut, KPI, Table at both 1-span and 2-span on a narrow viewport.
