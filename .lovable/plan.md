

# Fix: Guest Autocomplete Dropdown Not Visible in Scheduling Sheet

## Investigation

The autocomplete code in `GuestEmailInput.tsx` is fully implemented and correct — it queries org members via `useCustomerMembers`, filters by name/email, and renders a dropdown. The data exists in the database and the props are passed correctly through the component chain.

## Root Cause

The dropdown is rendered with `position: absolute` inside the `SheetContent` which has `overflow-y-auto`. When the scheduling sheet opens as a **nested sheet** (inside the candidate profile sheet), the dropdown gets clipped by the sheet's overflow container. The `z-50` class only affects stacking within that overflow context — it doesn't escape the clipping boundary.

## Fix

**File**: `src/components/scheduling/GuestEmailInput.tsx`

Use a React Portal to render the dropdown at the document root (escaping the sheet's overflow clipping), and dynamically position it below the input using `getBoundingClientRect()`.

### Changes

1. Import `createPortal` from `react-dom`
2. Add a `useEffect` + ref to calculate the input's position on screen
3. Render the dropdown via `createPortal(...)` to `document.body`, positioned absolutely using the input's bounding rect coordinates
4. Keep all existing filtering, keyboard navigation, and selection logic unchanged

### Positioning logic

```text
Input rect → dropdown positioned at:
  top: rect.bottom + 4px (gap)
  left: rect.left
  width: rect.width
```

Recalculate position when `showDropdown` becomes true and on window scroll/resize.

## Files changed

| File | Change |
|------|--------|
| `src/components/scheduling/GuestEmailInput.tsx` | Portal-render dropdown to escape sheet overflow clipping |

