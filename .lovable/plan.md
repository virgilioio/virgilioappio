# Redesign the Schedule Interview sheet — single-pass restructure

Goal: replace the current 3-step stepper in `ScheduleInterviewSheet.tsx` with a single unified screen that matches `35_Schedule_interview.html` / `.png`. Presentation only — all data hooks, mutations, availability, reschedule logic, and form validation stay untouched.

Reference: served at `public/_mock/schedule.html`. Visual targets — purple kicker (`PIPELINE · ONSITE`), lilac "Calendar-aware" badge, uppercase tracked section labels (10.5px Inter caps), 13px Poppins body, `bg-white border-virgilio-border rounded-2xl` section cards, green dot-pulse "Live check" / "Confirmed avail." pills, removable panelist chips, segmented duration control, horizontal availability timeline with per-panelist busy bars + FREE slot row, sticky footer.

---

## Phase 1 — Skeleton & layout shell

Replace the stepper container with a single scrollable body + sticky footer.

- Rip out `currentStep` state and the step switch; keep all data state (`selectedDate`, `selectedSlot`, `duration`, `selectedInterviewerIds`, `meetingType`, `customLocation`, `guestEmails`, form state, `oldBookingId`).
- New top-level layout inside `SheetContent`:
  ```text
  ┌ Header (kicker + title + Calendar-aware badge + helper) ┐
  ├ Scroll area                                              ┤
  │   [WHAT & WHO card]                                      │
  │   [WHEN card]                                            │
  ├ Sticky footer (helper · Cancel · Save draft · Send)      ┘
  ```
- Header: small purple `PIPELINE · {stageName}` kicker, `Schedule interview` title (`text-h2`), inline `<Badge tone="purple">Calendar-aware</Badge>`, one-line `text-body-sm text-virgilio-muted` helper. Reschedule path → kicker `RESCHEDULE · {stageName}`, primary button copy `Send new invite`.
- Section card primitive: reusable `<SectionCard label="WHAT & WHO" rightSlot={…}>` rendering label row (`text-form-label`) + card body (`bg-white border border-virgilio-border rounded-2xl p-5`).

Acceptance: sheet opens, renders header + two empty section cards + sticky footer with correct buttons; no console errors; reschedule banner/copy swap works.

---

## Phase 2 — WHAT & WHO card

Single card containing three rows:

1. **Interview stage select** — briefcase icon + stage name + duration suffix in label. Use `SearchableSelect` (stage already pre-selected from `scheduleStageId`; readonly visual when locked).
2. **Candidate row** — avatar + name + sub-line (`{role} · {company} · {timezone}`) on the left, green `<Badge tone="green" dot pulse>Confirmed avail.</Badge>` on the right. Pull from existing candidate prop data.
3. **Interviewers** — wrap of `<RemovableChip tone="purple">` per selected interviewer + dashed `+ Add panelist` chip (SearchableSelect trigger styled as dashed chip). Reuses current `selectedInterviewerIds` state + `ManualInterviewerSelector` data source.
4. Helper microcopy under field (`text-body-xs text-virgilio-muted`).

Acceptance: add/remove panelist updates state identically to today; stage select preserved.

---

## Phase 3 — WHEN card

Single card, label row with right-side `<Badge tone="green" dot pulse>Live check</Badge>`.

- **Row A**: `DatePickerVirgilio` (date) + `SearchableSelect` (timezone), two equal columns.
- **Row B — Available slots timeline**: inner `bg-[#FAFAF7] rounded-xl p-4` panel.
  - One row per selected panelist: 28px avatar + name + horizontal track with neutral busy bars positioned from `busy_events` returned by `useBookingAvailability`.
  - Final `FREE` row: selectable purple slot chips from `available_slots`; selected chip outlined in ink (`ring-2 ring-virgilio-ink`).
  - Helper line: `Found N slots that work for everyone`.
- **Row C**: Duration as segmented control (`30m | 45m | 60m | 90m`, reuse `ToggleButton` group pattern) + Buffer-time `Select` side-by-side.

All data wiring reuses existing `useBookingAvailability` call and current `selectedSlot`/`duration` setters. No new fetches.

Acceptance: selecting date refreshes slots; clicking a FREE chip sets `selectedSlot`; duration change refetches as today.

---

## Phase 4 — Sticky footer + submit wiring

- Footer: `border-t border-virgilio-border bg-white px-6 py-3 flex items-center justify-between sticky bottom-0`.
- Left: helper text `Sends a Google Meet invite to candidate + panelists`.
- Right cluster: `Cancel` (`variant="ghost"`), `Save as draft` (`variant="secondary"` + Save icon), primary submit (plain `<Button>` per form-submit memory) with `Send invite` / `Send new invite` copy and Send icon.
- Wire primary to the existing `createBooking` mutation handler currently used at the end of the stepper. Save-as-draft = no-op placeholder button (disabled with tooltip "Coming soon") unless a draft handler already exists — confirm during implementation.

Acceptance: submit creates booking with same payload as before; reschedule cancels old booking on success (unchanged path).

---

## Phase 5 — Cleanup & polish

- Remove unused stepper helpers, `currentStep`, step-navigation buttons, old confirmation form component (`InternalBookingConfirmationForm`) if fully superseded — otherwise keep and reuse its form fields inline in WHAT & WHO.
- Strip unused imports (`MonthCalendar`, `TimeSlotsList`, `DayCalendarEvents`, step icons).
- Verify with `lovable-exec test` build, open sheet from Current Stage card → Schedule and Reschedule paths, confirm visual parity with mock screenshot.

---

## Out of scope

- `SimpleScheduleInterviewSheet` (unchanged).
- Any availability/mutation/edge-function changes.
- New draft persistence backend.
