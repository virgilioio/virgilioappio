# Scrollable long menus + new "Score" question type

Two separate fixes.

## 1. Menus that run off the screen

Any menu opened near the bottom of the screen (the "Add question" menu in the job post setup sheet is the clearest example) is cut off with no way to scroll. The menu panels currently hide overflow and have no height limit, so options below the screen edge become unreachable.

Fix, applied once in the shared menu building blocks so every menu in the app benefits:

- Menus and popovers get a maximum height tied to the space actually available between the trigger and the screen edge, with vertical scrolling inside the panel when the list is taller.
- A small breathing gap is kept from the screen edges so a menu never sits flush against the top or bottom.
- Select-style dropdowns get the same available-height behaviour instead of a fixed cap, keeping their existing up/down scroll arrows.
- The "Add question" menu keeps its exact grouping, order, and copy; only scrolling changes.

## 2. New "Score" question type

A star-rating question for application forms, e.g. "Level of English" answered 1-5.

**Candidate side:** a row of clickable stars. Hover and keyboard focus preview the value, arrow keys move it, clicking the selected star clears it. The chosen value is announced for screen readers, and the caption below shows the picked number.

**Recruiter side (form builder):** "Score" appears as a new basic question type with a star icon. Its settings let the builder choose the range (1-5 or 1-10) and optionally type a label for the lowest and highest value, shown as small captions under the ends of the star row. Default is 1-5 with no labels.

**Where it shows:** the new type is available everywhere the shared field builder is used — job posting application forms (wizard step and posting sheet) and offer forms — and renders on the public application page and in stored answers as the number picked (e.g. `4`), so existing exports and views keep working.

## Technical notes

- `src/components/ui/dropdown-menu.tsx`, `popover.tsx`, `select.tsx`: replace `overflow-hidden` / `max-h-96` with `max-h-[var(--radix-*-content-available-height)]` + `overflow-y-auto`, and add `collisionPadding`. Sub-menu content gets the same treatment.
- Migration: add `score` to the `field_type` enum (additive, no data change).
- `src/hooks/useJobPostingFields.ts` and `useOfferFormFields.ts`: extend the `FieldType` union; config stored in the existing `field_config` JSON as `{ max: 5 | 10, min_label?, max_label? }`.
- New `src/components/forms/StarScoreInput.tsx` (presentational, controlled).
- `ApplicationFormBuilder.tsx`: add `score` to `BASIC_TYPES` and `TYPE_ICON`; add a settings popover for range and end labels via the existing `onUpdateFieldConfig` path.
- `FormFieldEditor.tsx` / `ALL_FIELD_TYPES`: include `score` with a label of "Score (stars)".
- `ApplicationFieldsRenderer.tsx`: new `case 'score'` rendering `StarScoreInput`; value persisted as a number.
- No changes to submission logic, permissions, or existing field behaviour.
