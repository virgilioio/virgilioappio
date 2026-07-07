## Root cause

The public posting's right-side card is `JobAsideSummary` driven by `summaryRows` (PublicJobPosting.tsx line 804), **not** `JobDetailsCard`. My earlier change only patched `JobDetailsCard`, which isn't rendered on this page — so the toggle still looks silently dropped in production.

`summaryRows` currently only surfaces Posted, Location, Type, Compensation (base salary only), Reports to, and Ref. There is no row for variable comp / commissions.

## Fix

Update `src/pages/PublicJobPosting.tsx` only:

1. Compute a `variableCompLabel` alongside `compensationLabel`, using the already-unified `details.hasCommissions` / `commissionsCurrency` / `commissionsAmount`:
   - `hasCommissions` false → `null` (row hidden)
   - `hasCommissions` true + amount → `"{currency} {amount}"` (e.g. `USD 20,000`)
   - `hasCommissions` true + no amount → `"Included"`
2. Add a new entry to `summaryRows` right after Compensation:
   ```
   { label: 'Variable comp', value: variableCompLabel }
   ```
   `JobAsideSummary` already hides rows whose `value` is null, so no other change is needed.
3. Leave `metaChips`, `JobDetailsCard`, and every other surface untouched — this is a UI-only presentation fix in the aside.

## Verification

- Posting with variable toggle ON + amount → right-side aside shows a "Variable comp" row with `{currency} {amount}`.
- Posting with variable toggle ON + no amount → right-side aside shows "Variable comp · Included".
- Posting with variable toggle OFF → row is absent.
- Legacy postings using the top-level `has_commissions` keys still render (already handled in the `details` memo).
- `bunx tsgo --noEmit` clean.

## Out of scope

- Any changes to wizard, edit sheet, or DB shape (already unified).
- `JobDetailsCard`, meta chips at the top of the page, or salary visibility logic.
