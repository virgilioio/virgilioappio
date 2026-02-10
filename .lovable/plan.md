

# Fix: Profile Summary Showing Raw Markdown

## Problem

The AI enrichment function generates profile summaries using **markdown formatting** (e.g., `**bold**`, `*italics*`, `---`). However, the display in `CandidateProfileSheet.tsx` uses the `SafeHtml` component, which only renders HTML. Since the content is markdown -- not HTML -- it shows the raw markup characters as literal text.

A `ProfileSummaryMarkdown` component already exists in the codebase (using `react-markdown`) but is not being used anywhere.

## Fix

### `src/components/candidates/CandidateProfileSheet.tsx` (around line 1431-1436)

Replace:
```tsx
<SafeHtml
  content={candidate.profile_summary}
  className="leading-relaxed ..."
/>
```

With:
```tsx
<ProfileSummaryMarkdown
  content={candidate.profile_summary}
  className="text-text-primary leading-relaxed"
/>
```

This uses the existing `ProfileSummaryMarkdown` component which properly renders markdown with styled headings, bold, italics, lists, and horizontal rules.

### Check other display points

The same fix should be applied anywhere `profile_summary` is displayed using `SafeHtml` or plain text. I'll audit `ApolloPreviewSheet.tsx` and any other files that render profile summaries.

## Files Modified

| File | Change |
|------|--------|
| `src/components/candidates/CandidateProfileSheet.tsx` | Swap `SafeHtml` for `ProfileSummaryMarkdown` when rendering profile summary |

## No functionality or backend changes needed.

