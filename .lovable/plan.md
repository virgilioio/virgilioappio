

# Fix: AI Notes Analysis Banner Disappearing

## Root Cause

Two problems make the banner fragile:

1. **`isAiDraft` is derived from props on every render** (line 129: `existing?.is_ai_draft === true`). If the `existing` prop changes for any reason (parent re-render, refetch, `viewingScorecard` async state), the banner condition can become false.

2. **The initialization `useEffect` resets `aiAnalysis` to `null`** whenever any `existing?.xxx` dependency changes (line 282). If `existing?.updated_at` or `existing?.general_overview` changes (e.g., after a save or parent refetch), the effect re-runs. If `is_ai_draft` happens to be falsy at that moment, `aiAnalysis` is wiped.

## Fix — `ScorecardSheet.tsx`

### 1. Store `isAiDraft` in state instead of deriving from props

Replace the derived `isAiDraft` (line 129) with a state variable that's set once when the sheet opens, inside the initialization effect. This way it won't change mid-session due to prop updates.

```typescript
const [isAiDraft, setIsAiDraft] = useState(false);
// Remove: const isAiDraft = existing?.is_ai_draft === true;
```

In the initialization effect (line 214), set it:
```typescript
setIsAiDraft(existing?.is_ai_draft === true);
```

### 2. Don't reset `aiAnalysis` on re-runs of the initialization effect

Change the initialization effect so it only sets `aiAnalysis` when the sheet first opens (or when `existing?.id` changes), NOT when other `existing` fields change. Add a guard:

```typescript
// Only set AI analysis on initial open, not on subsequent re-renders
if (existing?.is_ai_draft && existing?.general_overview) {
  setAiAnalysis(prev => prev ?? existing.general_overview);
  setIsAiDraft(true);
}
```

Or better: remove `existing?.is_ai_draft` and `existing?.general_overview` from the dependency array, since they only matter on initial open. The key deps should be `[open, existing?.id, draftKey, isAuthor]` — not the individual field values that change after saves.

### 3. Reset state only when the sheet closes

Add cleanup when `open` becomes false:
```typescript
if (!open) {
  setAiAnalysis(null);
  setIsAiDraft(false);
  return;
}
```

This ensures the AI state is fresh next time but persists for the duration of the current session.

