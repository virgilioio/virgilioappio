

# Add Copy-to-Clipboard Button for AI Analysis

Add a copy icon button next to the "Show analysis" toggle so recruiters can copy the AI analysis notes independently without applying the rating.

## Changes

### `src/components/candidates/ScorecardSheet.tsx`
- Import `Copy` icon from `lucide-react` and `copyToClipboard` from `@/utils/clipboard`
- On the collapsible analysis toggle row (line ~1000-1007), add a `Copy` icon button to the right side of that bar
- The button copies the raw `aiAnalysis` markdown text to clipboard with a success toast
- Layout: make the toggle row `justify-between`, keep the chevron + text on the left, copy button on the right
- Use `e.stopPropagation()` on the copy button so it doesn't toggle the analysis visibility

### `src/components/settings/styleguide/AiBannerGuide.tsx`
- Update the style guide to document that banners with collapsible analysis should include a copy button

