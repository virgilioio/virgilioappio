# Referee fields — the add-field flow

Rebuild Section 1 of the reference template editor (`Referee fields`) so fields are authored inline: a type picker and an inline editor that both render **above** the row list, twelve field types in three groups, locked rows for Full name / Work email, and counts shared between the section subtitle and the nav rail.

## What changes for the user

- `Add field` opens a picker above the list; the button flips to `Close`. Picking a type opens a lilac inline editor in the same spot.
- Clicking any existing row opens that same editor in place of the row.
- The editor has label + help text on the left and a type-specific config control on the right (options, precision, scale, range, character limit) — no right column when the type needs none.
- A plain-language status line replaces validation errors; save stays disabled until valid. No red text anywhere.
- `Full name` and `Work email` show a dimmed grip and a lock glyph instead of a bin, plus an `Always asked` badge. They stay editable.
- Section subtitle and nav rail both read `N fields · N required`, live.

## Type set

New, separate enum (never mixed with question types or the scorecard `field_type`):

```text
short_text | long_text | email | phone | link
select | multi_select | yes_no
date | date_range | number | rating
```

Groups in fixed order: Text & contact → Choice → Date & number. `rating` stays last in its group with the `Rarely used here` hint.

## Technical notes

**`src/lib/references/templateModel.ts`**
- Add `ReferenceFieldType` (12 values), `REFERENCE_FIELD_TYPES` catalogue (id, label, group, lucide icon, tooltip hint), `FIELD_CONFIG` map, `REFERENCE_FIELD_ICON`, and `newRefereeField(type)` (select/multi-select seed two empty options; date/date_range seed `precision: 'month_year'`; rating seeds `scale: 5`).
- Extend `RefereeField` with `locked?: boolean`, `precision?: 'month_year' | 'full_date'`, `scale?: 5 | 10`, `min?`, `max?`, `maxlen?`.
- Update `defaultRefereeFields()` to §7 exactly: rows 1–2 `locked: true`, row 7 `date_range` at month-and-year precision, row 6 `select` with the six relationship options.
- Add `normalizeRefereeFieldType()` mapping legacy stored values (`text`→`short_text`, `textarea`→`long_text`, others unchanged) plus a `locked` backfill by key (`name`, `email`), applied in `hydrate()` in `useReferenceTemplates.ts` so existing templates keep working. No DB migration needed — `referee_fields` is jsonb.

**`src/components/references/templates/sections/RefereeFieldsSection.tsx`** — rewritten:
- Local state: `mode: {kind:'idle'} | {kind:'picker'} | {kind:'draft', type} | {kind:'edit', id}`; opening one closes the other.
- `RefereeTypePicker` (grouped chips, spec chrome) and `RefereeFieldEditor` (header with type tile + title + Required toggle, two-column body, config controls, footer status line + Cancel/Save) as local components in the same folder.
- Committing a new field appends to the end; edit patches in place; commit strips empty option strings; cancel writes nothing.
- Rows: type tile, clickable text block (label, `Always asked` badge, help text, option pills, precision line), `TypeChip`, fixed 84px Required toggle. Locked rows are excluded from the sortable ids.

**`src/components/references/templates/rowKit.tsx`** — extend `RowShell` with `locked` and `onOpen`: dimmed non-draggable grip, lock glyph in place of the bin (`title="This field is always asked and can't be removed"`).

**Segmented control** — small local primitive in `rowKit.tsx` styled per §4.3.

**`TemplateEditor.tsx`** — compute `fieldsMeta = \`${n} fields · ${r} required\`` from `draft.referee_fields` and pass it to both the rail `summaries.referees` and the section subtitle; add the info footnote below the section card.

**Public candidate form** (`PublicReferenceSubmit.tsx`, `PublicField.tsx`) — extend the renderer so the new types render instead of falling through to a plain text input: `long_text` → textarea, `link` → url input, `multi_select` → checkbox group, `yes_no` → two-option select, `date`/`date_range` → month or date inputs honouring precision, `number` → numeric input with min/max, `rating` → simple scale. Row 6 keeps rendering as "Relationship to you".

## Out of scope

Questions (Section 3) type set, scorecard enums, and the referee questionnaire page stay untouched.
