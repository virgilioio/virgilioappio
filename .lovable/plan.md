

# Fix: Mobile Button Control Bar with Horizontal Scroll

## Problem

The controls card button container (line 831) uses `flex items-center gap-2` without any overflow handling. On mobile, the buttons exceed the viewport width, causing the entire page to scroll horizontally.

## Solution

Apply the same horizontal scroll pattern used in `CandidateNameCard` tabs:
- Add `overflow-x-auto` to allow horizontal scrolling within the card
- Add `scrollbar-none` for a cleaner mobile appearance (hide scrollbar but keep functionality)
- Add `min-w-max` to the inner flex container to prevent buttons from shrinking

This keeps buttons in a single scrollable row within the card, matching the established mobile UX pattern.

---

## File Changes

### `src/components/candidates/CandidateProfileSheet.tsx`

**Line 831** - Update the button container:

| Current | Updated |
|---------|---------|
| `<div className="flex items-center gap-2">` | `<div className="overflow-x-auto scrollbar-none"><div className="flex items-center gap-2 min-w-max">` |

**Line 903** - Close the additional wrapper div:

| Current | Updated |
|---------|---------|
| `</div>` | `</div></div>` |

---

## Visual Result

### Before (Mobile)
```text
┌─────────────────────────┐
│ [Add/Transfer] [Move to Offer] [Reject] ──► page scrolls
└─────────────────────────┘
```

### After (Mobile)
```text
┌─────────────────────────┐
│ [Add/Transfer] [Move to ◀──► swipe within card
└─────────────────────────┘
```

The buttons remain in a single row, scrollable by touch within the card boundary, without affecting the page layout.

---

## Testing

1. Open a job-associated candidate profile on mobile
2. Verify buttons are horizontally scrollable within the card
3. Confirm no horizontal scrolling on the entire page
4. Verify desktop layout remains unchanged

