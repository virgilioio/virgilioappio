## Fixes

### 1. `src/components/deals/billing/DealPaymentsCard.tsx`
The "Register payment" header button overrides the default styling with `className="bg-virgilio-purple hover:bg-virgilio-purple/90"`. Remove that override and use the plain `<Button>` (default variant) — same as `Create & Continue` in `JobWizard.tsx` line 270 and `Create Job` in `JobFormSheet.tsx` line 452.

### 2. `src/components/deals/billing/DealPaymentFormDialog.tsx`
- Replace the native `<Input type="date">` with `DatePickerVirgilio` from `@/components/ui/date-picker-virgilio` (the project's standard, already used by `DealFormSheet`). Convert between `Date` and the ISO `yyyy-MM-dd` string we store in state.
- Remove the `className="bg-virgilio-purple hover:bg-virgilio-purple/90"` override on the submit `<Button>` so it uses the default primary variant.

### 3. Memory — prevent recurrence
Add a new Core rule + dedicated memory file so future forms always pick the right primary submit button and the right date picker.

- New memory file `mem://style/forms/primary-submit-and-datepicker` with content:
  - **Primary submit button:** always `<Button type="submit">` (or `<Button>`) with **no variant and no `bg-*` className override**. The default variant is the workspace primary. Reference: `JobWizard.tsx` (`Create & Continue`), `JobFormSheet.tsx` (`Create Job`).
  - **Forbidden:** `className="bg-virgilio-purple ..."`, `variant="virgilio"` on submit buttons, and any other color override on a primary submit.
  - **Date picker:** always `DatePickerVirgilio` from `@/components/ui/date-picker-virgilio`. Never use `<Input type="date">`. Never wire a raw shadcn `<Calendar>` directly in form dialogs.
- Update `mem://index.md` Core section with one short line: `Forms: primary submit = plain <Button> (no variant/className). Dates = <DatePickerVirgilio>. Never override.` and add the new memory to the Memories list.

## Files

- Edit: `src/components/deals/billing/DealPaymentsCard.tsx`
- Edit: `src/components/deals/billing/DealPaymentFormDialog.tsx`
- New:  `mem://style/forms/primary-submit-and-datepicker`
- Edit: `mem://index.md`

## Out of scope

No DB changes, no functional/behavior changes — visual/style consistency only.
