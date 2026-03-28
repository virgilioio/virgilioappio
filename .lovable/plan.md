

# Fix: Mouse Click on Guest Autocomplete Still Triggers Validation Error

## Root cause

The `skipBlurRef` is set inside `addEmail()`, but the real problem is that `e.preventDefault()` on a portal-rendered `mousedown` doesn't reliably prevent the input's blur across all browsers. The blur fires, and by the time the 200ms timeout reads `skipBlurRef`, the sequence depends on exact event ordering between the portal click and the input blur — which is unreliable.

## Fix

**File**: `src/components/scheduling/GuestEmailInput.tsx`

Two changes:

1. **Dropdown item `onMouseDown`** (line 272): Set `skipBlurRef.current = true` explicitly *before* calling `addEmail`, so even if blur fires first, the ref is already set when the timeout checks it:

```tsx
onMouseDown={(e) => {
  e.preventDefault();
  skipBlurRef.current = true;
  if (email) addEmail(email);
}}
```

2. **Remove `skipBlurRef.current = true` from inside `addEmail`** (line 110): It belongs only in the mouse/keyboard handlers that trigger blur races, not in the generic `addEmail` function. The keyboard Enter handler in `handleKeyDown` should also set it before calling `addEmail`.

3. **Add `skipBlurRef = true` before `addEmail` in `handleKeyDown`** Enter key branch (line 148-150) and the comma/Enter branch (line 162-163).

This ensures `skipBlurRef` is always set *before* any blur timeout can read it, regardless of event ordering.

## Files changed

| File | Change |
|------|--------|
| `src/components/scheduling/GuestEmailInput.tsx` | Move `skipBlurRef` setting from `addEmail` to callers (`onMouseDown`, `handleKeyDown`) |

