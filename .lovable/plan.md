# Current Stage card → Schedule / Reschedule, then redesign the Schedule Interview sheet

Two phases. Phase 1 is small and self-contained. Phase 2 is the bigger visual refactor of the scheduling sheet, driven by the attached reference (`35_Schedule_interview.html` / `.png`).

---

## Phase 1 — Replace "Open stage" on the Current Stage card

File: `src/components/candidates/profile/CurrentStageCard.tsx`

Today the header has a single `link`-style "Open stage" button that opens the schedule sheet for interview/screening stages. We swap it for a real action that matches the candidate header's top "Schedule" button:

- **No upcoming booking** → `Schedule` button (icon `Calendar`, `variant="secondary"`, `size="md"`) — same look as the existing top-right Schedule button (`ProfileHeroCard`).
- **Has an upcoming booking** → `Reschedule` button (icon `CalendarClock` or `RefreshCw`, `variant="secondary"`, `size="md"`).
- Non-interview stages: hide the button entirely (current behavior preserved — `onOpenStage` was already gated to screening/interview).

Props change:
- Replace `onOpenStage?: () => void` with `onSchedule?: () => void` and `onReschedule?: (bookingId: string) => void`.
- Internally pick which to render based on `nextBooking` already computed in the file. When rescheduling, pass `nextBooking.id`.

File: `src/components/candidates/CandidateProfileSheet.tsx` (around line 1225)
- Wire `onSchedule` to the same flow that sets `scheduleStageId` / `scheduleStageName` and opens `ScheduleInterviewSheet`.
- Wire `onReschedule` to do the same plus pass `oldBookingId` into the existing `ScheduleInterviewSheet` props (it already supports `oldBookingId` for cancel-after-reschedule — see line 264 of that sheet).
- Add a new piece of state `rescheduleBookingId` and forward to the sheet.

No business-logic changes. No edits to `useStageBookings`, mutations, or the reschedule cancel path.

---

## Phase 2 — Redesign the Schedule Interview sheet to match the reference

File: `src/components/candidates/ScheduleInterviewSheet.tsx` (presentation only — keep mutations, availability hooks, calendar logic untouched).

Reference: `user-uploads://35_Schedule_interview.html` + `.png`. Before coding, the assistant will serve the HTML locally and use the internal browser to capture full-page + scrolled screenshots (the static PNG can't be scrolled).

Visual targets from the reference:
- **Header**: small purple kicker (`PIPELINE · ONSITE`), title `Schedule interview`, lilac "Calendar-aware" badge inline, one-line helper copy beneath. Close `X` top-right.
- **Section: WHAT & WHO** — uppercase tracked section label, single rounded card containing:
  - Interview stage select (briefcase icon + duration in label).
  - Candidate row: avatar + name + sub-line (`Senior Designer · Linear · America/New_York`) and a green "Confirmed avail." pill on the right.
  - Interviewers as removable chips + dashed "+ Add panelist" chip.
  - Helper microcopy under the field.
- **Section: WHEN** — section label with a green "Live check" pill on the right.
  - Date picker + Time-zone select, two columns.
  - "Available slots" horizontal timeline: rows per panelist (avatar + busy bars in neutral) and a final `FREE` row of selectable purple slot chips, the chosen one outlined in ink.
  - Found-N-slots helper.
  - Duration as segmented control (`30m | 45m | 60m | 90m`) + Buffer-time select side-by-side.
- **Footer (sticky)**: left helper "Sends a Google Meet invite to …", right: `Cancel` (ghost), `Save as draft` (secondary with save icon), `Send invite` (primary ink with send icon). Buttons use existing `Button` variants (`ghost`, `secondary`, `primary`), no custom CSS.

Tokens & primitives to use (per project memory):
- Section labels: `text-form-label` style (10.5px Inter caps + 0.06em).
- Body text: 13px Poppins for labels, 13/13.5px for values — match the Application/Offer card patterns we just landed.
- Section cards: `bg-white border border-virgilio-border rounded-2xl p-5` containers; the FAFAF7 inner slot panel for the timeline.
- Badges: `<Badge tone="purple" …>` for "Calendar-aware", `tone="green" dot pulse` for "Live check" and "Confirmed avail."
- Chips: existing `RemovableChip` for panelists; dashed "+ Add panelist" uses the SearchableSelect trigger styled as a chip.
- Segmented control for Duration: existing `TableSegmented` / `ToggleButton` pattern.
- Date input: `DatePickerVirgilio`. Time zone: `SearchableSelect`. Buffer-time: `Select`.
- Buttons: `Button` only — no overrides. Primary submit is plain `<Button>` (no variant) per the form-submit memory.

Behavior preserved (no logic refactor):
- All data flow (`useStageBookings`, availability, send-invite mutation, draft save, reschedule cancel-on-success) stays as-is.
- The new "Available slots" timeline is a presentational re-layout of the same `available_slots` / busy data already returned by `useBookingAvailability`.
- Reschedule path: when `oldBookingId` is set (Phase 1), the title kicker becomes `RESCHEDULE` and the primary button reads `Send new invite`; otherwise unchanged.

Out of scope for this round:
- New availability fetching, new mutations, new tables.
- The non-stage `SimpleScheduleInterviewSheet` keeps its current UI; we only touch the stage-aware `ScheduleInterviewSheet`.

---

## Suggested order of work

1. Land Phase 1 (small, immediately visible in the Current Stage card).
2. Spin up the reference HTML in the internal browser, capture scrolled screenshots, confirm the visual target with you.
3. Rebuild the sheet section-by-section (Header → What & Who → When → Footer), keeping a single PR-sized diff.
