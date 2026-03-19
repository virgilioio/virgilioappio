

# Fix Find Page Width Consistency, Add Icons, Collapse by Default + Scroll

## 3 Issues

1. **Width mismatch**: Other pages use `<Section banded container>` + `<Section container>` which wraps content in `AppContainer`. Find page uses raw `p-6` padding — no container constraint.
2. **No icons** on filter categories.
3. **Sections default open** and expanding the sidebar vertically instead of scrolling internally.

## Changes

### 1. `src/pages/Find.tsx` — Match page width

- Change header to `<Section variant="default" banded container className="animate-fade-in">` with `<PageHeader title="Find" compact />` inside (no extra `px-6` div)
- Wrap the main content area in `<Section container>` instead of raw `<div className="flex-1 flex gap-6 p-6 overflow-hidden">`
- The flex layout with filter panel + card stays inside the `Section container`, but now constrained to the same `AppContainer` max-width as Jobs/Candidates
- Add `overflow-hidden` and proper height calc so sidebar doesn't push page height

### 2. `src/components/sourcing/FindFilterPanel.tsx` — Icons + collapsed default + internal scroll

**Icons per section** — add a small icon next to each category label in `CollapsibleSection`:
- Job Titles → `Briefcase`
- Keywords → `Tag`
- Locations → `MapPin`
- Seniority → `TrendingUp`
- Company Size → `Users`
- Industry → `Factory`
- Target Companies → `Building2`
- Experience → `Clock`
- Contact Info → `Mail`

**Collapsed by default**: Change `CollapsibleSection` `defaultOpen` from `true` to `false`.

**Internal scroll**: The `Card` wrapper should have a fixed height (`h-full` or calc-based) with `overflow-y-auto` on an inner scrollable div. The "Search Criteria" header stays pinned at top. The card itself must not grow — filter content scrolls within.

Update `CollapsibleSection` to accept an `icon` prop (a Lucide component) and render it inline with the label.

### Files

| File | Change |
|------|--------|
| `src/pages/Find.tsx` | Use `Section container` for both header and body to match other pages |
| `src/components/sourcing/FindFilterPanel.tsx` | Add icons to each section, default collapsed, internal scroll |

