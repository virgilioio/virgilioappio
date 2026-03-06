

# Switch to Dotted Map Style

## Approach

Replace the `react-simple-maps` polygon map with the `dotted-map` package to render a stylized dot-grid world map. The `dotted-map` library generates an SVG string of the world as a grid of small circles, and we overlay larger colored circles as location markers — matching the reference aesthetic exactly.

To avoid expensive runtime computation, we'll **precompute** the map grid JSON at build time and embed it as a constant, then use `DottedMap` with the cached grid in the component.

## Changes

### 1. Install `dotted-map`, remove `react-simple-maps`

- `npm i dotted-map`
- Remove `react-simple-maps` from dependencies (no longer needed)

### 2. Generate precomputed map JSON

Create a small utility file `src/components/talent-insights/dotted-map-data.ts` that exports the precomputed map grid string (generated once using `getMapJSON`). This avoids the expensive grid computation on every render.

### 3. Rewrite `GeographyInsights.tsx`

- Import `DottedMap` with the precomputed grid
- For each country in `countryCounts`, call `map.addPin()` with the country centroid coordinates and purple color
- Call `map.getSVG()` to get the base map SVG string with dots in a muted color
- Render the SVG using `dangerouslySetInnerHTML`
- Overlay candidate markers as absolutely-positioned concentric circles (with ripple/glow effect) on top, or use `addPin` with larger radius and purple color
- Keep the right panel (total count, top countries, top cities) unchanged

### Layout (unchanged)
```text
┌────────────────────────────┬─────────────────────────┐
│  Dotted world map (SVG)    │  Total candidates       │
│  with purple pin markers   │  Top 5 countries + bars │
│                            │  Top 5 cities           │
└────────────────────────────┴─────────────────────────┘
```

## Files

- **Install**: `dotted-map`
- **Remove dep**: `react-simple-maps`
- **New**: `src/components/talent-insights/dotted-map-data.ts` — precomputed grid JSON
- **Rewrite**: `src/components/talent-insights/GeographyInsights.tsx` — use dotted-map instead of react-simple-maps

