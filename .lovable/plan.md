

# Fix Analytics Title & Pipeline Overflow

## 1. Analytics Page Title (lines 165-177)
The Analytics page uses a custom header with an icon, subtitle, and inline styled title instead of the standard `PageHeader` component used everywhere else. The subtitle also violates the "no subtitles" rule.

**Fix**: Replace the custom header block (lines 165-178) with the standard `<PageHeader title="Analytics">` component, moving the action buttons into the `children` slot. Remove the icon and subtitle.

**File: `src/pages/Analytics.tsx`**
- Import `PageHeader` from `@/components/layout/PageHeader`
- Replace lines 165-191 with `<PageHeader title="Analytics">` wrapping the export button and time filter as children

## 2. Pipeline JobRow Overflow (lines 47-49)
The job title `h3` has `truncate` but the parent flex container (`flex items-center gap-2` on line 47) doesn't constrain width properly — `min-w-0` is missing on the inner flex, causing the badge to push content beyond bounds.

**Fix in `src/components/pipeline/JobRow.tsx`**:
- Line 47: Add `min-w-0` to the `flex items-center gap-2` div
- Line 48: Ensure `h3` has `truncate` and `min-w-0`
- Line 49: Add `shrink-0` to the Badge so it never gets truncated itself

## Files

| File | Change |
|---|---|
| `src/pages/Analytics.tsx` | Replace custom header with `PageHeader` component, remove subtitle and icon |
| `src/components/pipeline/JobRow.tsx` | Add `min-w-0` to title row flex, `shrink-0` to status Badge |

