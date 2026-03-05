

# Fix AI Analysis Text Formatting

The AI transcript analysis uses a numbered section format like `1.\nOVERALL IMPRESSION` which `react-markdown` incorrectly parses as a broken ordered list — the number renders alone, and the heading text falls into a separate unstyled paragraph. This produces the poor formatting visible in the screenshot.

## Root Cause

The AI model outputs text like:
```
1.
OVERALL IMPRESSION
...paragraph text...

2.
KEY STRENGTHS
- bullet
- bullet
```

Markdown interprets `1.` followed by a newline as a list item, breaking the intended section structure.

## Solution

Add a preprocessing function that normalizes the AI analysis text before passing it to `ProfileSummaryMarkdown`. This function will:

1. Convert `\n1.\nOVERALL IMPRESSION` patterns into proper markdown headings: `## 1. OVERALL IMPRESSION`
2. Convert standalone ALL-CAPS lines (like `KEY STRENGTHS`) following a number into headings
3. Ensure section spacing with `---` horizontal rules between sections

### `src/components/candidates/ScorecardSheet.tsx`

- Add a `normalizeAiAnalysis(text: string): string` helper function (or inline utility) that:
  - Matches patterns like `\d+\.\s*\n\s*([A-Z\s]+)` and converts them to `## \d. \1`
  - Also handles the case where the number and title are on the same line but all-caps (e.g., `1. OVERALL IMPRESSION` → `## 1. Overall Impression`)
  - Adds a horizontal rule (`---`) before each section heading for visual separation
- Wrap `aiAnalysis` with this normalizer before passing to `ProfileSummaryMarkdown`:
  ```tsx
  <ProfileSummaryMarkdown
    content={normalizeAiAnalysis(aiAnalysis)}
    className="..."
  />
  ```

### `src/components/candidates/ProfileSummaryMarkdown.tsx`

- Increase spacing on headings: `mb-3 mt-4` for h2 to give breathing room between sections
- Add `space-y-1.5` or `mb-1.5` to list items for better bullet spacing
- Add `mb-4` to paragraphs for more separation

This keeps the fix localized — a preprocessing step to normalize the AI's output format into clean markdown, plus slightly improved spacing in the renderer.

