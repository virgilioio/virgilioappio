

# Metric Card Sparkline + Depth Upgrade

## Summary
Create a `MiniSparkline` component and wire it into the metric cards. Enhance card depth with shadows and larger icon circles.

## Changes

### 1. Create `src/components/ui/mini-sparkline.tsx`
Recharts `AreaChart` with no axes/grid/tooltip. Props: `data: number[]`, `color: string`, `height?: number`. Uses `linearGradient` fill (35% opacity → transparent), `strokeWidth={2.5}`, `type="monotone"`. Wrapped in `ResponsiveContainer`.

### 2. Modify `src/components/ui/metric-card.tsx`
- Card base: add `shadow-md`, hover becomes `hover:shadow-xl`
- Border: soften to `border-border/60`
- Icon circles: `w-12 h-12` default, `w-14 h-14` hero, `shadow-md` instead of `shadow-sm`
- Sparkline slots: `w-32 h-14` hero, `w-28 h-10` default

### 3. Modify `src/components/analytics/sections/OverviewSection.tsx`
Pass `MiniSparkline` to hero cards using existing `metrics.trendData`:
- Applications: `trendData.map(d => d.applications)`, color = Virgilio Purple
- Hires: `trendData.map(d => d.hires)`, color = success green
- Avg Time to Hire: no sparkline (aggregate value)

Add `iconColor` props to match sparkline colors.

### 4. Modify `src/components/analytics/sections/InterviewHealthSection.tsx`
Extract sparkline data from `data.trendData` for inline cards:
- Scheduled: `trendData.map(d => d.scheduled)`, purple
- Completed: `trendData.map(d => d.completed)`, green

### 5. Modify `src/components/settings/styleguide/MetricCardGuide.tsx`
Add sparkline examples using `MiniSparkline` with sample data arrays to document the feature.

