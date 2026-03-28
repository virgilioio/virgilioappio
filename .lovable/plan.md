

# Fix: "Invalid email format" Error When Clicking Guest Autocomplete Option

## Root Cause

When clicking a dropdown suggestion, two things happen simultaneously:

1. The input **blurs** → `handleBlur` fires with a 200ms delay
2. The `onMouseDown` handler on the dropdown item calls `addEmail(member.email)` and sets `showDropdown = false`

The race: after 200ms, `handleBlur`'s timeout fires. By then `showDropdown` is `false`, so the guard `!showDropdown` passes, and it calls `addEmail(inputValue)` where `inputValue` is the partial search text (e.g. "elo") — which fails email validation → "Invalid email format".

## Fix

**File**: `src/components/scheduling/GuestEmailInput.tsx`

**Change `handleBlur`** (lines 168-175): After the dropdown click adds the email, `inputValue` gets cleared to `''`. Check for that:

```typescript
const handleBlur = () => {
  setTimeout(() => {
    if (inputValue.trim() && !showDropdown) {
      addEmail(inputValue);
    }
  }, 200);
};
```

The problem is `inputValue` is stale inside the timeout closure. Use a ref to track whether a dropdown selection just happened:

1. Add a ref: `const justSelectedRef = useRef(false)`
2. In `addEmail`, when called from dropdown click, set `justSelectedRef.current = true`
3. In `handleBlur` timeout, check `if (justSelectedRef.current) { justSelectedRef.current = false; return; }`

Alternatively (simpler): just set `inputValue` to `''` in the `onMouseDown` handler **before** calling `addEmail`, so by the time the blur timeout fires, `inputValue.trim()` is falsy and the guard short-circuits.

**Simplest fix** — update `handleBlur` to re-read `inputValue` via a ref:

1. Add `const inputValueRef = useRef(inputValue)` and keep it synced
2. In `handleBlur`, read `inputValueRef.current` instead of the stale closure value

**Recommended approach** (least code, most robust): Add a `skipBlurRef`:

```typescript
const skipBlurRef = useRef(false);

// In addEmail, at the top:
skipBlurRef.current = true;

// In handleBlur:
const handleBlur = () => {
  setTimeout(() => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    if (inputValue.trim()) {
      addEmail(inputValue);
    }
  }, 200);
};
```

This ensures that whenever `addEmail` is called (from dropdown click, Enter key, etc.), the subsequent blur timeout is skipped.

## Files changed

| File | Change |
|------|--------|
| `src/components/scheduling/GuestEmailInput.tsx` | Add `skipBlurRef` to prevent blur handler from validating stale input after dropdown selection |

