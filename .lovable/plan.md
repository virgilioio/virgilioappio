
# Feature: Add "Schedule Interview" Button to Independent Candidate Profile

## Summary

Replace the current (non-existent) booking link copy functionality in the Independent Candidate Profile Sheet with a proper "Schedule Interview" button. This allows users to directly schedule meetings with candidates who are not associated with any job pipeline.

---

## Current State Analysis

### IndependentCandidateProfileSheet (Right Controls Card - lines 680-742)
Currently has:
- Edit button
- Download button  
- Add Note button
- Send Email button
- **No booking/scheduling button**

### CandidateProfileSheet (Job-Context - lines 1506-1521)
Has:
- Edit, Download, Add Note, Send Email
- "Copy [user's name]'s Link" button (copies user's generic booking URL)

The user wants the Independent sheet to have "Schedule Interview" instead, allowing direct interview scheduling without a stage context.

---

## Solution Overview

Create a simplified scheduling flow for non-stage-associated interviews:

1. **New Component**: `SimpleScheduleInterviewSheet.tsx` - A stripped-down version of `ScheduleInterviewSheet` that:
   - Uses the current user's booking configuration
   - Allows selecting any team member with an active booking config
   - Schedules a "simple/generic" booking (no job_id, stage_id, or association_id)
   - Creates calendar events without transcript ingestion

2. **Integration**: Add the button to `IndependentCandidateProfileSheet.tsx` in the right controls card

---

## Files to Create

### `src/components/candidates/SimpleScheduleInterviewSheet.tsx`

A new sheet component for scheduling standalone interviews:

```text
┌──────────────────────────────────────────────┐
│  📅 Schedule Interview                        │
│  ──────────────────────────────────────────  │
│  Candidate: John Doe                          │
│                                               │
│  ┌─ Step 1: Select Interviewer ─────────────┐ │
│  │ ◯ Alice Smith (30 min slots)             │ │
│  │ ◯ Bob Johnson (45 min slots)             │ │
│  │ ◯ Current User (30 min slots)            │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ Step 2: Select Duration ────────────────┐ │
│  │ [15 min] [30 min] [60 min]               │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ Step 3: Select Date & Time ─────────────┐ │
│  │ [Calendar] [Time Slots]                  │ │
│  └──────────────────────────────────────────┘ │
│                                               │
│  ┌─ Step 4: Confirm Details ────────────────┐ │
│  │ Name: John Doe                           │ │
│  │ Email: john@example.com                  │ │
│  │ ☑ Send invitation to candidate           │ │
│  │                    [Cancel] [Schedule]   │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

**Key differences from `ScheduleInterviewSheet`:**
- No `jhsId`, `stageName`, `jobId`, `jobTitle`, `associationId` props
- Uses `ManualInterviewerSelector` (already supports manual selection)
- Calls `create-booking` edge function WITHOUT job/stage context
- Creates a "simple booking" (per memory: `generic-vs-pipeline-booking-logic`)

**Props:**
```typescript
interface SimpleScheduleInterviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  organizationId: string;
}
```

---

## Files to Modify

### `src/components/candidates/IndependentCandidateProfileSheet.tsx`

**1. Add imports (top of file):**
```typescript
import { SimpleScheduleInterviewSheet } from './SimpleScheduleInterviewSheet';
import { Calendar } from 'lucide-react';
```

**2. Add state (after line ~78):**
```typescript
const [scheduleOpen, setScheduleOpen] = useState(false);
```

**3. Add button in right controls card (around line 738, after "Send Email" button):**
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setScheduleOpen(true)}
>
  <Calendar className="h-4 w-4 mr-2" />
  Schedule Interview
</Button>
```

**4. Add sheet component (before closing `</>` of the fragment, after `MinimizableEmailComposer`):**
```typescript
{candidateId && organizationId && candidate && (
  <SimpleScheduleInterviewSheet
    open={scheduleOpen}
    onOpenChange={setScheduleOpen}
    candidateId={candidateId}
    candidateName={candidate.candidate_name || 'Candidate'}
    candidateEmail={candidate.email || ''}
    candidatePhone={candidate.phone}
    organizationId={organizationId}
  />
)}
```

---

## Technical Implementation Notes

### Booking Creation Flow

The `create-booking` edge function already supports non-job bookings:

```typescript
// When these are NOT provided, it creates a "simple booking"
job_id: null,              // No job association
candidate_id: candidateId, // Still link to candidate record
job_candidate_association_id: null, // No pipeline association  
job_hiring_stage_id: null, // No stage association
```

Per the memory `generic-vs-pipeline-booking-logic`:
- Simple bookings skip transcript ingestion
- Skip AI scorecard generation
- Use custom event title from booking config
- Are excluded from recruiting-specific task lists

### Reusable Components

The new sheet will reuse existing components:
- `ManualInterviewerSelector` - For selecting team members with booking configs
- `InterviewDurationSelector` - For duration selection
- `MeetingLocationSelector` - For Google Meet vs custom location
- `MonthCalendar` - For date selection
- `TimeSlotsList` - For time slot selection
- `useBookingAvailability` - For fetching available slots

### Calendar Event Details

For simple bookings, the calendar event title uses the interviewer's `custom_event_title` setting (or defaults to "Interview with {candidate_name}"), per memory `generic-booking-custom-title`.

---

## Database Impact

No schema changes required. The `scheduled_bookings` table already supports nullable job-related columns:
- `job_id` (nullable)
- `job_candidate_association_id` (nullable)
- `job_hiring_stage_id` (nullable)

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No team members have booking configs | Show alert with link to booking settings |
| Candidate has no email | Show alert requiring email before scheduling |
| Time slot becomes unavailable | 409 error handled, prompt to select different time |
| User schedules interview | Booking created, linked to candidate_id only |

---

## Testing Checklist

1. Open independent candidate profile → Schedule Interview button visible
2. Click Schedule Interview → Sheet opens with interviewer selection
3. Select interviewer → Calendar shows their availability
4. Select date and time → Confirmation form appears
5. Submit → Booking created, calendar events sent
6. Verify booking is NOT linked to any job/stage
7. Verify booking appears in candidate's activity feed
