

# Redesign Talent Intelligence Charts to Match Analytics Style

The Analytics charts now have the Pulse Card DNA — gradient fills, pill tooltips, no grid noise, Virgilio palette. The Talent Intelligence charts (Experience Distribution and Skills Landscape) are still using flat colors, basic tooltips, and old-style cards. Here's what I'd do:

---

## A. Experience Distribution — Two Sub-Charts

### Years of Experience (Bar Chart)
- **Add gradient fills** to bars using SVG `<linearGradient>` (top-to-bottom, purple at 25% opacity fading to 0), matching the Area chart pattern
- **Remove the basic `Tooltip`** and replace with the **pill-style tooltip** (rounded-2xl, Poppins, purple box-shadow)
- **Round bars more** — `radius={[6, 6, 0, 0]}` instead of `[4, 4, 0, 0]`
- **Clean up axes** — `tickLine={false}`, `axisLine={false}` for a quieter look

### Seniority Levels (Pie → Donut)
- Already a donut — but missing the **center stat** (total count) that the Analytics `CandidateStatusPieChart` now has
- Add the **absolute-positioned center stat** with total count + "Total" label
- Replace inline `label` prop with a **clean legend below** using the same colored-dot chip pattern from Analytics
- Apply the **pill tooltip** style
- Use `stroke="none"` on cells for cleaner segments

### Card wrapper
- Swap the raw `Card` for `AnalyticsChartCard` (or replicate its pattern) to get the consistent icon + title header

---

## B. Skills Landscape (Horizontal Bar Chart)
- **Add horizontal gradient fills** to bars using SVG `<linearGradient>` (left-to-right, purple fading out) — matching the Funnel chart's gradient bar style
- **Replace the basic tooltip** with the pill-style tooltip
- **Clean up axes** — remove tick lines and axis lines
- **Add colored dot** before the "Top Skills Across Candidates" subtitle, matching the Funnel stage labels
- **Round bars more** — `radius={[0, 6, 6, 0]}`
- Top 5 skills get a subtle **glow/shadow** (like the Funnel's "Hired" bar) to highlight the most common skills

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/talent-intelligence/ExperienceDistribution.tsx` | Gradient bar fills, pill tooltips, donut center stat, clean legend, axis cleanup |
| `src/components/talent-intelligence/SkillsLandscape.tsx` | Gradient horizontal bars, pill tooltips, top-5 glow, axis cleanup |

