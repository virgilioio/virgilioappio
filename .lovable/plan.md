# Interviewers field — dotted "+ Add panelist" pill with inline autocomplete

Refine the `PanelistComboField` inside `ScheduleInterviewSheet.tsx` so the entry point matches the reference: a dotted, pill-shaped **+ Add panelist** button that sits inline with the selected chips. Clicking it turns the pill into a typeable input with an autocomplete dropdown of hiring-team members. Selecting one adds a chip and the pill returns to its dotted resting state, ready for the next add.

## Visual spec

Container: no outer input shell. Just a flex-wrap row of selected chips followed by the trigger pill, all on the page background.

Selected chip (unchanged):
- `<RemovableChip tone="purple" size="sm">` with mini avatar + name + ×.

Trigger pill — resting state:
- Pill shape: `h-7 px-3 rounded-full`.
- Dashed border: `border border-dashed border-virgilio-border` (slightly stronger on hover: `hover:border-virgilio-purple/50`).
- Background: transparent, `hover:bg-[hsl(var(--badge-lilac))]/40`.
- Text: `text-[12px] font-poppins font-medium text-virgilio-ink/70`, `+ Add panelist`.
- Focus ring: `focus-visible:ring-2 focus-visible:ring-virgilio-purple/30`.

Trigger pill — active (typing) state:
- Same height/radius/dashed border, but border becomes solid `border-virgilio-purple/40` and bg `bg-white`.
- Renders a borderless `<input>` with `placeholder="Type a name…"`, autofocus.
- Min width 140px, grows with text via auto-sizing (`size` attr or a hidden span).
- `Esc` or blur with no selection → revert to resting pill.
- `Backspace` on empty input → remove last chip.

Dropdown:
- Radix `Popover` anchored to the pill, `align="start" sideOffset="6"`.
- `Command` list, width matches pill min 220px / max 320px.
- Filters hiring-team members by name (case-insensitive `includes`), excludes already-selected.
- Row: avatar (20px) + name + small role/email muted line.
- Empty state: `No matches.`
- `Enter` selects highlighted row; click also selects. After selection the input clears and stays open for rapid multi-add until `Esc`/outside click.

Group mode (`schedulingMode === 'all'`): no trigger pill, panelists render as read-only `<Badge>` (unchanged behavior).

Helper line below the row stays: `Calendars sync from Google Workspace. Gio finds shared slots in real time.`

## Behavior

- Source list: existing `useStageInterviewerAssignments` + `useStageBookingInterviewers` already feed available + selected members. No data changes.
- Add selects → call existing `addInterviewer` mutation (already wired).
- Remove via chip × → existing `removeInterviewer` mutation.
- All other sections of the sheet untouched.

## Files

- `src/components/candidates/ScheduleInterviewSheet.tsx` — rewrite the `PanelistComboField` subcomponent only.

## Out of scope

- Availability timeline, Location & Notes, Invitation card — all stay as currently built.
- No backend or hook changes.
