

# Fix Event Type Sheet: Time Pickers + Dropdowns

## Changes

### 1. WeeklyScheduleEditor — Use `TimePickerVirgilio` instead of `<Input type="time">`

The weekly schedule editor currently uses raw `<Input type="time">` for start/end times (lines 84-96). Replace these with `TimePickerVirgilio` to match the style guide. This gives the proper Virgilio-styled popover with Morning/Afternoon/Evening groups and 15-min intervals.

### 2. Meeting tab — Replace `MeetingDurationSelector` radio group with a `Select` dropdown

Replace the radio-button-based `MeetingDurationSelector` with a simple `Select` dropdown offering common durations: 15, 30, 45, 60, 90, 120 minutes.

### 3. Meeting tab — Replace Buffer Time `Slider` with a `Select` dropdown

Replace the slider (lines 230-241) with a `Select` dropdown offering: 0, 5, 10, 15, 20, 30, 45, 60 minutes.

### 4. Rules tab — Replace `Input type="number"` fields with `Select` dropdowns

- **Minimum Notice**: Replace the number input (lines 258-264) with a `Select` dropdown offering: 0, 1, 2, 4, 8, 12, 24, 48, 72 hours.
- **Maximum Days Ahead**: Replace the number input (lines 270-276) with a `Select` dropdown offering: 7, 14, 30, 60, 90 days.

## Files changed

| File | Change |
|------|--------|
| `src/components/settings/booking/WeeklyScheduleEditor.tsx` | Replace `<Input type="time">` with `TimePickerVirgilio` |
| `src/components/settings/booking/EventTypeSheet.tsx` | Replace MeetingDurationSelector, Slider, and number Inputs with Select dropdowns for duration, buffer, notice, and max days |

