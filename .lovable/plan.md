

# Improve AI Analysis Text Readability

The AI analysis content currently renders as dense, poorly-spaced text. Headings like "1. OVERALL IMPRESSION" lack visual weight, paragraphs run together, and there's no breathing room between sections.

## Changes

### `src/components/candidates/ScorecardSheet.tsx` (line ~1026-1029)

Replace the current `SafeHtml` rendering with `ProfileSummaryMarkdown` (which uses `react-markdown` with proper heading, paragraph, list, and link styling) — or alternatively, significantly improve the prose utility classes on the `SafeHtml` element.

**Preferred approach**: Use `ProfileSummaryMarkdown` since the `aiAnalysis` is markdown and this component already handles all the formatting properly with appropriate spacing.

Replace:
```tsx
<SafeHtml
  content={markdownToHtml(aiAnalysis)}
  className="text-sm text-foreground prose prose-sm max-w-none [&_h1]:... ..."
/>
```

With:
```tsx
<ProfileSummaryMarkdown
  content={aiAnalysis}
  className="[&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-pastel-purple/30"
/>
```

This gives us:
- Proper heading sizing and bold weight with bottom margins
- Paragraph spacing (`mb-2`, `leading-relaxed`)
- Styled bullet/numbered lists with spacing
- Links styled with primary color
- Horizontal rules for section separation

Single-file change, swapping one component for another that's already imported elsewhere in the codebase.

