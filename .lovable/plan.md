# Unify Variable / Commission across wizard, edit, and public card

## Problem confirmed
Three surfaces use three different shapes for the same data:

| Surface | Keys used |
|---|---|
| Job Wizard (Step 4) | `details.compensation.variable_enabled` / `commission_currency` / `commission_amount` |
| Posting edit sheet | `details.has_commissions` / `commissions_currency` / `commissions_amount` (top-level) |
| Public posting card | Reads both, but only renders when a numeric amount is present |

Consequences:
1. Opening a wizard-created posting in the edit sheet shows the toggle **off** (Sheet never reads the `compensation.*` shape).
2. Saving in the Sheet writes only the top-level keys, so wizard-shape data is left stale/orphaned.
3. Public right-side card renders nothing when the toggle is on but no amount was entered — silent drop.

## Fix

### 1. Single canonical shape
Standardize on the nested shape written by the wizard:
```
details.compensation = {
  variable_enabled: boolean,
  commission_currency: string | null,
  commission_amount: number | null,
}
```
Keep a one-time read fallback from the legacy top-level `has_commissions / commissions_currency / commissions_amount` so existing postings still hydrate.

### 2. `src/components/jobs/postings/PostingSheet.tsx`
- On load: hydrate state from `details.compensation.*` first, then fall back to the legacy top-level keys.
- On save: write only into `details.compensation` and **omit** the legacy top-level keys (or explicitly set them to `null`) so the two representations can't diverge again.
- Match the wizard's visual treatment: use the same `ToggleRow` + label/hint copy already present ("Include variable / commission" / "On-target earnings, sales commission, or bonus structure."), same `CurrencySelect` + amount field layout as `JobPostingStep.tsx`.

### 3. `src/pages/PublicJobPosting.tsx`
- Continue reading both shapes in the `details` memo (compensation first, legacy fallback).
- Update `JobDetailsCard` so the commission line renders when `hasCommissions` is true, even without an amount:
  - With amount → `Avg commissions: {currency} {amount}`
  - Without amount → `Variable compensation included` (short label, same row style as the salary line)
- Keep the block hidden entirely when `hasCommissions` is false.

### 4. No DB migration
Data lives in the existing `job_postings.details` jsonb; no schema change required. Legacy postings continue to render via the fallback read.

## Verification
- Create a job through the wizard with variable ON + amount → open in edit sheet: toggle is ON, currency + amount pre-filled.
- Toggle OFF in edit sheet, save, reopen: stays OFF; public card hides the line.
- Toggle ON in edit sheet with no amount, save: public card shows "Variable compensation included".
- Open a pre-existing posting that only had the legacy top-level keys: still hydrates correctly, and a subsequent save migrates it into `details.compensation`.
- `bunx tsgo --noEmit` clean.

## Out of scope
- Any change to the parent `jobs` table salary fields.
- Reworking the salary visibility toggle (handled previously).
