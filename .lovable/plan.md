

# Make Search Dialog Full-Screen on Mobile

**File: `src/components/search/SearchResultsDialog.tsx`** (line 71)

Change the `DialogContent` className to be full-screen on mobile:
```
max-w-2xl → sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[85vh]
```

Add mobile-specific classes to make it fill the entire screen:
- `fixed inset-0 sm:relative` or override the dialog's default centering
- `rounded-none sm:rounded-lg` to remove rounded corners on mobile
- `max-h-full sm:max-h-[85vh]` for full height on mobile

The simplest approach: add `w-full h-full max-h-full sm:max-h-[85vh] rounded-none sm:rounded-lg` to the DialogContent, which will make it fill the viewport on mobile while keeping the centered modal on desktop.

Also update the results area `max-h-[400px]` (line ~128) to `max-h-[60vh] sm:max-h-[400px]` or use `flex-1 overflow-y-auto` so results fill available space on mobile.

| File | Change |
|---|---|
| `src/components/search/SearchResultsDialog.tsx` | Add full-screen mobile classes to DialogContent, flex-grow results area |

