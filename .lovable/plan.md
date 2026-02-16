

## Fix Currency Selector Inside Job Sheet/Wizard

### Problem
The currency dropdown (Popover + Command combobox) cannot be interacted with when rendered inside a Sheet component. This is a known Radix UI issue where the parent Sheet's modal behavior (focus trapping and outside-click detection) interferes with the Popover's portaled content.

### Fix
Add `modal={true}` to the `Popover` component wrapping the currency selector in both places where it appears:

1. **`src/components/jobs/JobFormSheet.tsx`** (edit form) -- line 273
2. **`src/components/jobs/wizard/JobInfoStep.tsx`** (creation wizard) -- line 166

This single prop change tells Radix to give the Popover its own focus scope and dismiss handling, preventing the Sheet from swallowing click events on currency items.

### Technical Details

| File | Change |
|---|---|
| `src/components/jobs/JobFormSheet.tsx` | Change `<Popover open={currencyOpen} onOpenChange={setCurrencyOpen}>` to `<Popover open={currencyOpen} onOpenChange={setCurrencyOpen} modal={true}>` |
| `src/components/jobs/wizard/JobInfoStep.tsx` | Same change on the currency Popover |

No other files or dependencies are affected.

