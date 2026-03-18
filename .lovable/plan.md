

# Fix JobRow Badge Overflow on Mobile

**Root cause**: Line 45's div (`flex items-center gap-3 min-w-0`) lacks `overflow-hidden`. Even though the inner div (line 47) has it, the parent flex container at line 45 doesn't constrain its width, so the `shrink-0` badge pushes content out.

**Fix in `src/components/pipeline/JobRow.tsx`**:

1. **Line 45**: Add `overflow-hidden` → `flex items-center gap-3 min-w-0 overflow-hidden`
2. **Line 42**: Add `overflow-hidden` to AccordionItem → `border rounded-lg px-4 overflow-hidden` to ensure the accordion itself clips content at the boundary.

These two additions complete the overflow-hidden chain from the accordion boundary down to the truncated title, ensuring the badge stays within bounds on mobile.

| Line | Current | Change |
|------|---------|--------|
| 42 | `border rounded-lg px-4` | Add `overflow-hidden` |
| 45 | `flex items-center gap-3 min-w-0` | Add `overflow-hidden` |

