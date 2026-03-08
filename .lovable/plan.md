

# Metric Card Redesign — Horizontal Pill Style

## Inspiration from the reference

The image shows **wide horizontal pill cards** with three zones:
1. **Left:** Colored icon inside a white/light circle
2. **Center:** Bold title on top, large value + suffix below
3. **Right:** A sparkline mini-chart in the icon's accent color

The cards are rounded, spacious, and feel modern. Each card is a horizontal strip rather than a square box.

## What changes

### Visual redesign of all three variants

**Default variant** — becomes a horizontal pill:
- `rounded-2xl` with generous padding
- Left: icon in a white circle with subtle shadow (`bg-white shadow-sm rounded-full p-2.5`)
- Center: title (small, muted) above value (bold, `text-2xl`)
- Right: optional sparkline slot, rendered in the card's accent color
- Layout: `flex items-center` horizontal, not stacked
- Subtle border, soft shadow on hover

**Hero variant** — same horizontal layout but slightly taller:
- Larger value (`text-3xl`), larger icon circle
- More prominent sparkline area

**Inline variant** — stays minimal for use inside `MetricCardGroup`, but adopts the same font sizing and spacing

### New optional `iconColor` prop
The reference uses different colors per card (red, purple, orange, blue). We should support an `iconColor` prop that tints the icon and its sparkline. Default remains Virgilio Purple. This isn't the old "custom background" approach — it's a single accent color for icon + chart consistency.

### Files to modify

1. **`src/components/ui/metric-card.tsx`** — complete visual rework of default and hero variants to horizontal pill layout with icon circle, sparkline slot on the right
2. **`src/components/ui/metric-card-group.tsx`** — adjust border-radius to match new rounded style
3. **`src/components/settings/styleguide/MetricCardGuide.tsx`** — update examples to show the new horizontal layout with sparkline slots and icon colors
4. **`src/components/analytics/sections/OverviewSection.tsx`** — no structural changes needed (already uses hero + grouped), just benefits from visual update
5. **`src/components/talent-intelligence/SummaryMetricsRow.tsx`** — no code changes needed, automatic visual update
6. **`src/pages/Pipeline.tsx`** — no code changes needed

### Proposed MetricCard default layout (ASCII)

```text
┌──────────────────────────────────────────────────────┐
│  ┌─────┐                                             │
│  │ 📊  │  Title                        ╭─╮  ╭─╮     │
│  │     │  142 applications             │ │╭─╯ │     │
│  └─────┘                               ╰─╯   ╰─    │
└──────────────────────────────────────────────────────┘
```

### Key design tokens
- Card: `rounded-2xl border-border bg-card`
- Icon circle: `w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center`
- Icon: `h-5 w-5` tinted with `iconColor` (default: `text-primary`)
- Title: `text-xs font-poppins font-medium text-muted-foreground`
- Value: `text-2xl font-poppins font-bold text-foreground` (hero: `text-3xl`)
- Sparkline area: `w-24 h-10 shrink-0` on the right side

This is purely a visual/CSS change to the existing component. All existing props and consumers continue to work without modification.

