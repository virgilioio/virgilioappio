## Problem

The wizard's "Compensation" section (step "Job posting") and the "Compensation & location" section in the edit posting sheet are two disconnected UIs writing to two different data models:

- **Wizard** writes to the parent `jobs` row: `salary_min`, `salary_max`, `currency`, `show_salary_public`, `include_equity`, `include_signing_bonus`, and a `compensation` object on the posting for commission only. Toggle is a Switch (`ToggleRow`).
- **Edit posting sheet** (`PostingSheet.tsx`) writes to `posting.details` a different shape: `salary_amount` (single number), `salary_period`, `salary_currency`, `show_salary` (as a Checkbox, unchecked by default), `has_commissions`, `commissions_*`. It never reads or writes the job-level fields set by the wizard.

Result: after creating a job with salary via the wizard, opening the posting to edit shows an empty checkbox and a different UI shape; changes there don't reflect the wizard's intent and the public page falls back to job fields anyway (`PublicJobPosting.tsx` already prefers `posting.details` and falls back to `jobs.salary_min/max/currency/show_salary_public`).

## Goal

Make the edit posting sheet's compensation section look and behave like the wizard, share the same data model, and keep both in sync so the "Show salary" toggle set at job creation is honored and editable later.

## Changes

### 1. `src/components/jobs/postings/PostingSheet.tsx` — Compensation section rewrite

Replace the current salary trio (currency / amount / period + Checkbox) with the wizard's layout and controls, keeping Location/Employment type/Location type untouched:

- **Currency** — `CurrencySelect` (unchanged control, same value)
- **Min salary** — `SalaryInput` (new state `salaryMin`)
- **Max salary** — `SalaryInput` (new state `salaryMax`), with the same "Min must be lower than max" inline validation used in `JobPostingStep`
- **Show salary on public posting** — `ToggleRow` (Switch), same label + hint as wizard, bound to `showSalaryPublic`
- **Include equity** — `ToggleRow`, bound to `includeEquity`
- **Include signing bonus** — `ToggleRow`, bound to `includeSigningBonus`
- **Include variable / commission** — `ToggleRow` (existing `hasCommissions` state, renamed to `variableEnabled` for consistency) plus the current commissions currency + amount fields when enabled

Drop the `salary_amount` single-number field and `salary_period` select entirely — the wizard's min/max range is the source of truth. Keep `commissions_*` as today.

### 2. Data loading — read from job first, posting.details as override

When the sheet opens, fetch the parent job (via `postings.job_id`) once and seed state in this priority:

1. `posting.details.salary_min/salary_max/salary_currency/show_salary_public/include_equity/include_signing_bonus` if present (posting-level override written by the new sheet)
2. Otherwise fall back to `jobs.salary_min/salary_max/currency/show_salary_public/include_equity/include_signing_bonus` (wizard-written values)

This guarantees an edit sheet opened right after the wizard reflects the wizard's toggle state and range.

### 3. Data saving — write to both places

On save, in `buildDetails()`:

- Store the wizard-shape fields in `posting.details`: `salary_min`, `salary_max`, `salary_currency`, `show_salary_public`, `include_equity`, `include_signing_bonus` (replacing the old `salary_amount`/`salary_period`/`show_salary` keys).
- Additionally, `UPDATE public.jobs SET salary_min, salary_max, currency, show_salary_public, include_equity, include_signing_bonus WHERE id = posting.job_id` so the parent job (used as fallback by the public page and by the wizard summary) stays in sync.
- Keep `has_commissions`/`commissions_currency`/`commissions_amount` writes exactly as today.

### 4. Public rendering compatibility

`src/pages/PublicJobPosting.tsx` already reads `d.salary_amount` with a fallback to `jobs.salary_min/max`. Since we're removing `salary_amount` from `details` and always writing `salary_min/salary_max` to both the job and the details, add a tiny read-side tweak: prefer `d.salary_min/d.salary_max` when present, else fall back to `jobRow.salary_min/max` (which already happens). Also honor `d.show_salary_public` in addition to the legacy `d.show_salary` key. No schema change, no visual change on the public page.

### 5. Legacy key cleanup

For existing postings that only have `salary_amount`/`salary_period`/`show_salary`, the loader will map them once at open time: `salaryMin = salaryMax = salary_amount`, `showSalaryPublic = show_salary`. Saving from the new sheet then rewrites `details` with the unified keys. No migration needed.

## Out of scope

- No changes to the wizard.
- No changes to the `jobs` schema.
- No changes to Location / Employment type / Location type controls.
- No changes to commissions UI beyond wrapping it in the wizard-style `ToggleRow` for the enable switch.
- No changes to the public careers page visual layout.

## Verification

1. Create a job through the wizard with salary range + "Show salary on public posting" ON → open the posting sheet: range, currency, and Switch reflect the wizard values.
2. Toggle Show salary OFF in the sheet, save → reopen: still OFF; parent `jobs.show_salary_public` is also OFF (checked via a quick `supabase--read_query`).
3. Public posting page shows the range only when the toggle is ON, whether set from the wizard or the sheet.
4. Legacy posting with only `salary_amount` opens without crashing, values map into min/max, saving normalizes to the new keys.
