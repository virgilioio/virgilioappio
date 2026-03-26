

# Fix AI Analysis Formatting in Key Takeaways

## Root Cause

When "Apply Suggestion" is clicked, `handleAcceptAiSuggestion` (line 715) does:
```typescript
setOverview(markdownToHtml(aiAnalysis))
```

But `aiAnalysis` is the raw `existing.general_overview` string — which may be JSON or unformatted numbered sections. The `normalizeAiAnalysis` function that properly converts these formats to structured markdown is only called for the collapsible preview display (line 1098), **not** when applying the suggestion to Key Takeaways.

## Fix

**File: `src/components/candidates/ScorecardSheet.tsx`** — line 715

Change:
```typescript
setOverview(markdownToHtml(aiAnalysis));
```
To:
```typescript
setOverview(markdownToHtml(normalizeAiAnalysis(aiAnalysis)));
```

This pipes the AI analysis through the same normalization (JSON-to-markdown conversion, numbered section heading detection) before converting to HTML for the rich text editor.

## Summary

| File | Change |
|------|--------|
| `src/components/candidates/ScorecardSheet.tsx` | Add `normalizeAiAnalysis()` call before `markdownToHtml()` in `handleAcceptAiSuggestion` |

One-line fix. No other files affected.

