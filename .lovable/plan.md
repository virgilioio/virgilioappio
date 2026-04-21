

## Wire AND-mode into the in-app "Schedule Interview" sheet

### Problem
The public booking link already supports AND-mode (group availability, group create-booking, multi-attendee invites). But the internal **"Schedule Interview"** sheet inside the candidate profile (`ScheduleInterviewSheet.tsx`) still only shows the OR-style "pick one interviewer" picker — even when the stage is configured as AND. Users have to use the public link as a workaround.

### Goal
When a stage's `interviewer_scheduling_mode = 'all'`, the in-app sheet should skip the per-interviewer picker and go straight to the **conjuncted (intersected) availability view** across all required/optional interviewers, then create a single group booking.

### Changes

**File: `src/components/candidates/ScheduleInterviewSheet.tsx`** (only file)

1. **Read the stage's scheduling mode** — query `job_hiring_stages.interviewer_scheduling_mode` for the current `jhsId` (reuse the same pattern as `useStageInterviewerAssignments.ts`, or just inline the select alongside the existing interviewers query).

2. **Branch the UI on `schedulingMode === 'all'`**:
   - **Skip Step 1 (interviewer picker)**. Don't render the "Select Interviewer" cards.
   - **Header summary**: replace the single-avatar block with a stacked-avatar row + "Interview with **Alice, Bob & Carol**" using the same `formatNamesList` helper pattern as `PublicBookingPage`.
   - **Auto-select all eligible interviewers** as a `groupInterviewers` array (filter: `assignment_type !== 'backup'` AND `booking_configurations.is_active`).
   - **Guard**: if fewer than 2 interviewers have active booking configs, show an inline alert: "AND-mode requires at least 2 interviewers with active booking links. Configure availability for: [names]." Suppress the calendar until resolved (offer a link to the stage settings).

3. **Switch the availability query to group mode**:
   - `useBookingAvailability` already supports the `bookingConfigIds` array param. Pass it when in AND-mode:
     ```ts
     const groupConfigIds = groupInterviewers.map(i => i.booking_configurations!.id);
     const { data: availabilityData, isLoading } = useBookingAvailability(
       schedulingMode === 'all' ? undefined : selectedInterviewer?.booking_configurations?.id,
       monthStart, monthEnd, selectedDuration, candidateTimezone,
       true, // internal_scheduling
       undefined, // no event-type overrides
       schedulingMode === 'all' ? groupConfigIds : undefined
     );
     ```
   - The `get-booking-availability` edge function already intersects schedules and merges all hosts' Google Calendar busy slots. No backend work needed.

4. **Switch the booking creation to group mode**:
   - In `handleConfirmBooking`, when AND-mode, send `booking_config_ids: groupConfigIds` instead of `booking_config_id`. The `create-booking` edge function already supports the group path (multi-conflict check, `scheduled_booking_attendees` insert, multi-interviewer Google Calendar attendees, per-interviewer notification emails).
   - Success toast becomes: `"Interview scheduled with Alice, Bob & Carol for {stageName}."`

5. **Day-side panel (`DayCalendarEvents`)**: in AND-mode the `busy_events` returned represent the union of all hosts' busy times — keep the panel but update its label to "Combined busy times across interviewers".

6. **Back-navigation**: in AND-mode, "Back to interviewers" never shows (there's no picker step). Skip that branch in `handleBack`.

### Out of scope
- Rescheduling existing AND-mode bookings (the reschedule path already routes through this sheet, and once steps 1–4 land, reschedule will inherit the group flow automatically as long as the stage is still in AND-mode — verify after).
- Stage settings UI for AND/OR — already shipped in `TeamTab.tsx`.
- Email/ICS multi-attendee logic — already shipped in `create-booking`.

### Files touched
- `src/components/candidates/ScheduleInterviewSheet.tsx` — only file. No DB changes, no edge function changes, no new hooks.

### Technical notes
- `formatNamesList` helper: define locally (small, ~6 lines) using the same Oxford-comma + `&` style used elsewhere.
- The existing `availableInterviewers` memo already filters out backup + inactive-config — reuse it for `groupInterviewers` in AND-mode.
- Keep the OR-mode code path completely intact; only branch on `schedulingMode === 'all'`.

