

## Fix: Country Options Not Appearing in Location Search

### Root Cause
There is a double-filtering conflict in the `LocationSelector` component. The code manually filters options by `label` (lines 55-58), but the `cmdk` library (`Command` component) also runs its **own built-in filtering** on the `value` prop of each `CommandItem`.

For country entries, the `value` is a 2-letter code (e.g., `"IN"` for India). When you type "India":
- The manual filter correctly matches `label: "India"` and includes it
- But cmdk's internal filter checks `value: "IN"` against "India" and hides it

For cities/states this was never a problem because their values contain full names (e.g., `"New York,New York,US"`).

### Fix

**File: `src/components/sourcing/LocationSelector.tsx`**

Set the `CommandItem` `value` prop to the **label** instead of the short code, so cmdk's built-in filtering matches on the human-readable name. Then use a data attribute or closure to pass the actual value to `onSelect`.

Specifically:
- Change `value={location.value}` on CommandItem to `value={location.label}`
- Update `onSelect` to receive the label (which cmdk lowercases), then look up the original location value from `LOCATION_OPTIONS`
- Alternatively (simpler): disable cmdk's built-in filtering entirely by adding `shouldFilter={false}` to the `Command` component, since we already do manual filtering on lines 53-59

The `shouldFilter={false}` approach is cleanest here since the manual filtering logic is already correct and complete.

### Changes
- Add `shouldFilter={false}` to the `<Command>` element (1 line change)
- No other files need changes

