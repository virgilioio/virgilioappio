

# Fix: Select Button Not Enabling Checkboxes in Application Review

## Root Cause

Two mismatched state variables. The "Select" button for non-recruiting tabs toggles `tableSelectionMode`, but the Application Review `CandidateTable` reads from `selectionMode`. Clicking "Select" changes `tableSelectionMode` while the table ignores it.

This affects **both** render paths (mobile and desktop) — both have a Select button toggling `tableSelectionMode` while the CandidateTable on the application tab uses `selectionMode`.

## Fix

**`src/pages/JobDetail.tsx`** — Two locations need the same fix.

**Location 1 (~line 1082-1090)**: The `else` branch Select button for non-recruiting tabs in the mobile/first content block. Change from `tableSelectionMode` to `selectionMode`:

```tsx
<Button
  size="sm"
  variant={selectionMode ? 'secondary' : 'outline'}
  onClick={() => setSelectionMode((v) => !v)}
  aria-pressed={selectionMode}
>
  Select
</Button>
```

**Location 2 (~line 1497-1505)**: Same pattern in the desktop floating sidebar content block. Change from `tableSelectionMode` to `selectionMode`.

This unifies the toggle so the CandidateTable's `selectionMode` prop actually reflects the button state. The `tableSelectionMode` state variable can then be removed entirely since nothing else uses it.

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Replace `tableSelectionMode` with `selectionMode` in both non-recruiting Select buttons (~lines 1083-1090 and 1498-1505); remove unused `tableSelectionMode` state |

