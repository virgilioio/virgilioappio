# Schedule Interview — UX refinements

Three focused changes to `src/components/candidates/ScheduleInterviewSheet.tsx`. No business-logic or data changes — UI/UX only.

## Phase 1 — Panelist combobox field

Replace the dashed `+ Add panelist` pill + separate `ManualInterviewerSelector` panel with a single inline combobox field that contains both the selected chips and the typeahead input.

- New presentational component `PanelistComboField` (co-located in the sheet file, or `src/components/candidates/scheduling/PanelistComboField.tsx` if it grows).
- Visual: one rounded input shell (`h-auto min-h-10 px-2 py-1.5 rounded-lg border border-virgilio-border bg-white focus-within:ring-2 focus-within:ring-virgilio-purple/30`) containing the selected `RemovableChip`s followed by a borderless `<input>` that grows to fill remaining space. Placeholder switches: `"Add panelist…"` when chips exist, `"Search hiring team…"` when empty.
- Dropdown: Radix `Popover` anchored to the input, opens on focus or first keystroke. Renders a `Command` list of available hiring-team members (already loaded via existing `availableInterviewers` / `ManualInterviewerSelector` data source) filtered by the input text. Each row = avatar + name + role hint, plus a muted "No calendar" sub-line for entries in `interviewersWithoutBookingConfig` (rendered disabled).
- Keyboard: `Backspace` on empty input removes last chip; `Enter` / click selects the highlighted option; `Esc` closes the popover.
- Reuse the same selection callback as today (`setSelectedInterviewer(i)` for single mode, group mode just disables the input + hides the "Add" affordance). The `Plus` dashed-pill button and the standalone `ManualInterviewerSelector` block below the chips are removed from this section.
- Group-mode (`isGroupMode === true`) keeps the read-only `Badge` rendering, no input shown.

## Phase 2 — Compact availability timeline

Tighten the `WHEN` calendar visualization to match the reference.

- Replace the wrap-grid of time-slot pill buttons in the `FREE` row with a **single horizontal track** matching the per-panelist rows. The track is the same width / `left%` / `width%` coordinate system as the busy bars above.
- Render each available slot as a small purple block (`bg-[hsl(var(--badge-lilac))]`) positioned at its time on the track. The currently selected slot becomes a darker purple block (`bg-virgilio-purple` text `white`) with the start time printed inside it (e.g. `2:00`). Non-selected blocks stay un-labeled to keep the row clean.
- Panelist rows: keep avatar + name in the 140px gutter; the busy bars stay as today. Add subtle vertical hour-gridlines behind every row (9–18) so busy bars and FREE blocks read against the same grid.
- Click on any free block selects that slot (same handler). Hover shows a tooltip with the full time range. The "Found N slots…" helper stays below.
- The whole `Available slots` block height drops to roughly `panelists × 28px + 36px header + 32px FREE row`, so adding interviewers no longer balloons the section.

## Phase 3 — Location row + Invitation card

Restructure the bottom `LOCATION & NOTES` section to match the two screenshots.

- **Format row (horizontal):** Replace the current vertical `MeetingLocationSelector` with three equal-width cards in a `grid-cols-1 md:grid-cols-3 gap-3` row: `Video call` (Google Meet · auto-generated), `Phone` (We'll dial out), `On-site` (address text). Selected card = `border-virgilio-purple ring-1 ring-virgilio-purple/30 bg-[hsl(var(--badge-lilac))]/40`; idle = `border-virgilio-border bg-white`. Each card: icon top-left, title 13px Poppins medium, sub-line 12px Inter muted. When `On-site` is chosen, the address `Input` appears as a thin field directly beneath the row (not inside the card).
- Drop the separate `Candidate name` / `Candidate email` grid and the standalone `Notes for the panel` textarea from this section (they move into the Invitation card below as the recipient + message).
- **New `INVITATION` section card** (own `SectionCard label="INVITATION"`), with a right-slot `Generate with Gio` ghost button (sparkle icon, lilac hover — no backend wiring this pass; clicking is a no-op placeholder).
  - `Subject *` — single-line `Input`, pre-filled with `"{stageName} — {jobTitle} with {tenantName/Acme Talent}"` (best-effort from existing props; falls back to plain stage + job).
  - `Message (optional)` — `Textarea`, min-height 140px, pre-filled with a short template using candidate first name + panelists + duration.
  - `Attachments (optional)` — chip list of attached files + dashed `+ Add file` pill. Attachments are local state only this pass (`File[]`), wired into the existing `create-booking` payload only if a field already exists — otherwise UI-only placeholder.
  - Three toggle rows with title + helper + `Switch` on the right:
    - `Include scorecard prompt in invite`
    - `Auto-record with Gio note-taker`
    - `Reminder 24h before`
  - Each toggle stored in local sheet state (`includeScorecardPrompt`, `autoRecord`, `reminder24h`), defaults `true`. Persistence wiring is out of scope unless the create-booking payload already accepts them.
- The existing `GuestEmailInput` stays, moved under the Invitation card as a small "Cc additional guests" row.
- The current `Send email invitation to candidate` master switch is removed (the Reminder/Scorecard toggles + the always-on invite cover the intent; the underlying `sendInvitation` defaults to `true`).

## Out of scope

- No changes to `create-booking` / `cancel-booking` edge functions, availability hook, or any DB schema.
- No new "Generate with Gio" AI call — placeholder only.
- No real attachment upload backend — local-state UI only.
- No changes to the top half of the sheet (header, WHAT & WHO card other than the panelist field swap).

## Technical notes

- Files touched: `src/components/candidates/ScheduleInterviewSheet.tsx` (primary), possibly extract `PanelistComboField.tsx`, `FormatPickerRow.tsx`, `InvitationCard.tsx`, `AvailabilityTimelineTrack.tsx` if the sheet file grows past comfort.
- Components reused: `Badge`, `RemovableChip`, `Popover`, `Command`, `SearchableSelect` patterns, `SectionCard`, `Button`, `Switch`, `Input`, `Textarea`, `DatePickerVirgilio`.
- Existing free-slot computation (`timeSlotsForSelectedDate`, `busyBarsForPanelist`, `useBookingAvailability`) is preserved verbatim; only the rendering layer changes.
- All styles via existing semantic tokens — no new colors.
