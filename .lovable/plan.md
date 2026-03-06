

# Add World Map to Geography Insights

## Approach

Replace the current horizontal bar chart with a **dot-map world map** similar to the reference image. Use `react-simple-maps` — a lightweight React library for SVG maps that requires no API keys and works well with recharts-style tooltips.

Layout will mirror the reference: map on the left (~60%), country breakdown list with progress bars on the right (~40%), plus a big total count.

## Changes

### 1. Install `react-simple-maps`
Add `react-simple-maps` package (renders world map as SVG using TopoJSON).

### 2. Rewrite `GeographyInsights.tsx`

**New layout (inside the Card):**

```text
┌──────────────────────────────────────────────────────┐
│  Candidate Geography                                 │
├────────────────────────────┬─────────────────────────┤
│                            │  {totalCandidates}      │
│   World Map (SVG)          │  Global candidates      │
│   with purple bubbles      │                         │
│   sized by candidate count │  🇺🇸 United States  90% │
│                            │  ████████████████░░  │
│                            │  🇧🇷 Brazil         40% │
│                            │  ████████░░░░░░░░░░  │
│                            │  ...top 5 countries     │
└────────────────────────────┴─────────────────────────┘
```

- **Map**: Use `ComposableMap` + `Geographies` + `Geography` for the base map (light gray dots/shapes), then overlay `Marker` circles for each country with known coordinates
- **Country coordinates**: Build a static lookup of ~50 common country centroids (lat/lng). Match by country name from `countryCounts`
- **Bubble size**: Scale circle radius by candidate count (min 4px, max 20px)
- **Bubble color**: Virgilio Purple with opacity
- **Hover tooltip**: Show country name + candidate count on hover
- **Right panel**: Total candidates count (large number), then top 5 countries with name + percentage bar (purple fill)
- **Styling**: Gray landmasses, no borders emphasis, purple bubbles — matching the reference aesthetic
- Keep the **Top Cities** list below the map as a secondary section

### 3. Country coordinate mapping

A static `Map<string, [lng, lat]>` for ~50 common countries. Countries not in the lookup simply won't show a bubble (graceful degradation).

## Files

- **Install**: `react-simple-maps`
- **Rewrite**: `src/components/talent-insights/GeographyInsights.tsx`
- No data hook changes needed — `countryCounts` and `cityCounts` already available

