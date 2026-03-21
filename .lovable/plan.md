

# Replace "Schedule for Later" with Preset + Custom Dropdown

## Problem

Both the Application Review sheet and the standalone Rejection Dialog currently show a raw date/time picker when "Schedule for later" is selected. The user wants quick presets (1 day, 2 days, etc.) with a "Custom" option that reveals the date picker.

## Approach

Create a shared `ScheduleDelaySelector` component used by both locations. When the user picks "Schedule for later", instead of immediately showing a date picker, show a `Select` dropdown with:

- **Tomorrow morning** (next day 9:00 AM)
- **In 2 days** (+2 days 9:00 AM)
- **In 3 days** (+3 days 9:00 AM)
- **Next week** (+7 days 9:00 AM)
- **Custom** → reveals DatePickerVirgilio + TimePickerVirgilio

The component outputs a resolved `Date` regardless of which option is picked.

## Changes

### 1. New: `src/components/candidates/ScheduleDelaySelector.tsx`

A reusable component that:
- Takes `value: { preset: string; customDate?: string; customTime?: string }` and `onChange`
- Renders a `Select` with preset options + "Custom"
- When "Custom" is selected, shows `DatePickerVirgilio` + `TimePickerVirgilio` below
- Exposes a `getResolvedDate()` helper or computes the resolved date via a callback

### 2. `src/components/candidates/ApplicationReviewSheet.tsx`

Replace the current `DatePickerVirgilio` + `TimePickerVirgilio` block (lines 419-432) with `<ScheduleDelaySelector>`. Update `RejectionConfig` fields: replace `scheduledDate`/`scheduledTime` with `schedulePreset` + `customScheduledDate`/`customScheduledTime`.

### 3. `src/components/candidates/RejectionEmailComposer.tsx`

Replace the date/time picker block (lines 223-236) with `<ScheduleDelaySelector>`. Replace `scheduledDate`/`scheduledTime`/`scheduledDateTime` state with the preset-based state.

### 4. `src/hooks/useApplicationReview.ts`

Update `RejectionConfig` interface to use `schedulePreset`, `customScheduledDate`, `customScheduledTime`. Update `handleReject` to resolve the preset into a concrete date before passing to mutation.

## Files

| File | Change |
|------|--------|
| `src/components/candidates/ScheduleDelaySelector.tsx` | New shared component with preset dropdown + custom date/time |
| `src/components/candidates/ApplicationReviewSheet.tsx` | Use `ScheduleDelaySelector` in RejectionConfigPanel |
| `src/components/candidates/RejectionEmailComposer.tsx` | Use `ScheduleDelaySelector` in send timing section |
| `src/hooks/useApplicationReview.ts` | Update `RejectionConfig` fields; resolve preset in `handleReject` |

