

# Fix: Skills Generation Crash on Undefined Category Label

## Root Cause

Line 232 in `JobSkillsGenerationPanel.tsx`:
```typescript
getCategoryLabel(category as keyof SkillsByCategory).split(' ')[0]
```

`getCategoryLabel` returns `undefined` when the `category` key doesn't exist in its internal labels map. This happens when the AI returns a category not in the predefined set (e.g., a typo or unexpected key). Calling `.split()` on `undefined` throws `TypeError: Cannot read properties of undefined (reading 'split')`, which the ErrorBoundary catches and blanks the screen.

## Fix

Add a fallback so that if `getCategoryLabel` returns `undefined`, we use the raw category string instead. This is a one-line defensive fix.

### `src/components/jobs/JobSkillsGenerationPanel.tsx` — Line 232

Change:
```typescript
{getCategoryLabel(category as keyof SkillsByCategory).split(' ')[0]} ({skills.length})
```
To:
```typescript
{(getCategoryLabel(category as keyof SkillsByCategory) || category).split(' ')[0]} ({skills.length})
```

Apply the same pattern to any other `getCategoryLabel` calls in the file that don't have a fallback.

## Files changed

| File | Change |
|------|--------|
| `src/components/jobs/JobSkillsGenerationPanel.tsx` | Add fallback to all `getCategoryLabel` calls to prevent crash on unknown categories |

