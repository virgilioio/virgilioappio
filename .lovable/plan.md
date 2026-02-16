

## Create Shared CurrencySelect Component + Style Guide Entry

### Problem
1. Currency selectors are duplicated across 5 files with two inconsistent patterns (searchable combobox vs simple dropdown)
2. The `PostingSheet` uses a basic `Select` that doesn't work reliably inside modal `Sheet` components in production
3. `InterviewQuestionForm` has its own local copy of the CURRENCIES array
4. No visibility of this component in the Style Guide for reference

### Solution
Create a single reusable `CurrencySelect` component, replace all 5 implementations with it, and add it to the Style Guide.

### New Files

**1. `src/components/ui/currency-select.tsx`**

A self-contained searchable currency combobox that:
- Uses `Popover` (with `modal={true}`) + `Command` for search/filter
- Accepts `value`, `onChange`, `disabled`, and `placeholder` props
- Uses the global `CURRENCIES` constant from `@/constants/currencies`
- Works reliably inside Sheet/Dialog modals

**2. `src/components/settings/styleguide/CurrencySelectGuide.tsx`**

A new Style Guide section showing the CurrencySelect in its various states:
- Default (no selection)
- With a pre-selected value (e.g. USD)
- Disabled state

Follows the same Card-based pattern used by `FormElementsGuide`, `ButtonGuide`, etc.

### Files to Update

| File | Change |
|---|---|
| `src/components/ui/currency-select.tsx` | Create shared component using Popover+Command pattern with `modal={true}` |
| `src/components/settings/styleguide/CurrencySelectGuide.tsx` | Create Style Guide entry showing default, pre-selected, and disabled states |
| `src/components/settings/StyleGuide.tsx` | Import and render `CurrencySelectGuide` alongside existing guide sections |
| `src/components/jobs/postings/PostingSheet.tsx` | Replace both salary and commissions `Select` dropdowns with `CurrencySelect` |
| `src/components/jobs/JobFormSheet.tsx` | Replace inline Popover+Command block (~40 lines) with `CurrencySelect` |
| `src/components/jobs/wizard/JobInfoStep.tsx` | Replace inline Popover+Command block (~40 lines) with `CurrencySelect` |
| `src/components/candidates/CandidateFormSheet.tsx` | Replace inline Popover+Command block (~40 lines) with `CurrencySelect` |
| `src/components/jobs/stage-config/InterviewQuestionForm.tsx` | Replace simple `Select` + local CURRENCIES duplicate with `CurrencySelect` |

### Impact
- Fixes the production currency selector bug in PostingSheet
- Removes ~150+ lines of duplicated code across 5 files
- Consistent searchable UX everywhere
- Future currency changes happen in one place
- Visible in the Style Guide for team reference

