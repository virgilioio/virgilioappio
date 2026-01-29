
# Plan: Fix UI Consistency and Add Custom Event Title for Simple Scheduling

## Problem Summary

1. **UI Inconsistency**: The `SimpleScheduleInterviewSheet` has a different visual layout than `ScheduleInterviewSheet`:
   - Different card wrapping for duration and location selectors
   - Side-by-side calendar/time grid vs vertical stack
   - Missing back navigation buttons
   - Different interviewer display styling

2. **Missing Custom Event Title**: Users cannot personalize the meeting title when scheduling manually. The system only uses the interviewer's default `custom_event_title` from their booking configuration.

---

## Solution

Refactor `SimpleScheduleInterviewSheet` to match the exact visual structure and flow of `ScheduleInterviewSheet`, and add a custom event title input field.

---

## Files to Modify

### `src/components/candidates/SimpleScheduleInterviewSheet.tsx`

#### Part 1: Match the UI structure from ScheduleInterviewSheet

**Changes:**
1. Remove the `grid grid-cols-1 md:grid-cols-2` layout for calendar/time slots - use vertical stack instead
2. Wrap Duration selector in a `Card` > `CardContent p-6`
3. Wrap Meeting Location selector in a `Card` > `CardContent p-6`
4. Wrap Calendar in a `Card` > `CardContent p-6`
5. Wrap TimeSlots in a `Card` > `CardContent p-6`
6. Change selected interviewer display to match stage-based styling (`bg-secondary/30 rounded-lg`)
7. Add back navigation button ("← Back to interviewers", "← Back to time selection")
8. Add "Select Date & Time" heading like stage-based sheet
9. Show interviewer duration info like stage-based (`Clock` icon with "X minutes")

#### Part 2: Add custom event title field

**Add new state:**
```typescript
const [customEventTitle, setCustomEventTitle] = useState<string>('');
```

**Add new form field** in the confirmation step (before notes field):
```tsx
<FormItem>
  <FormLabel>Meeting Title</FormLabel>
  <FormControl>
    <Input 
      placeholder="Interview with {candidate_name}" 
      value={customEventTitle}
      onChange={(e) => setCustomEventTitle(e.target.value)}
    />
  </FormControl>
  <p className="text-xs text-text-secondary">
    Leave blank to use default. Use {'{candidate_name}'} to include their name.
  </p>
</FormItem>
```

**Pass to booking data:**
```typescript
const bookingData = {
  // ... existing fields
  custom_event_title: customEventTitle || null, // Pass custom title override
};
```

### `supabase/functions/create-booking/index.ts`

**Accept override from request:**
```typescript
const {
  // ... existing fields
  custom_event_title, // Per-booking title override
} = await req.json();
```

**Modify title generation logic (around line 130-139):**
```typescript
let interviewTitle: string;
if (isJobSpecificBooking) {
  interviewTitle = `${stageName} with ${candidate_name}${jobTitle}`;
} else {
  // Priority: request override > config default > fallback
  const titleTemplate = custom_event_title || config.custom_event_title || 'Interview with {candidate_name}';
  interviewTitle = titleTemplate.replace(/{candidate_name}/g, candidate_name);
}
```

---

## Visual Comparison (After Fix)

| Element | Before (Simple) | After (Matches Stage) |
|---------|-----------------|----------------------|
| Duration selector | Not wrapped | Wrapped in Card |
| Location selector | Not wrapped | Wrapped in Card |
| Calendar/Time layout | Side-by-side grid | Vertical stack |
| Interviewer display | Card with CheckCircle | bg-secondary/30 rounded-lg |
| Back buttons | Missing | Present ("← Back to...") |
| Headings | "Select Date & Time" missing | Added heading |
| Custom title input | Not available | Added to confirmation form |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/candidates/SimpleScheduleInterviewSheet.tsx` | Refactor UI layout, add custom title field |
| `supabase/functions/create-booking/index.ts` | Accept and prioritize per-booking title override |

---

## Testing Checklist

1. Open Simple Schedule Interview sheet from independent candidate profile
2. Verify interviewer selection UI matches stage-based flow
3. Verify calendar/time selection layout matches stage-based flow
4. Verify back navigation buttons work correctly
5. Test custom event title field:
   - Leave blank → uses interviewer's default
   - Enter custom title → appears on calendar event
   - Use `{candidate_name}` placeholder → correctly replaced
6. Verify job-specific scheduling still uses stage-based titles (not affected)
