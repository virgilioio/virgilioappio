
# Feature: Replace "Copy Link" with "Schedule Interview" in Job Candidate Profile

## Summary

Replace the "Copy [user name]'s Link" button in the job-associated candidate profile sheet (`CandidateProfileSheet`) with a "Schedule Interview" button that allows direct interview scheduling without stage association.

---

## Current State

**CandidateProfileSheet (lines 1506-1521):**
```tsx
{bookingUrl && (
  <Button onClick={() => {
    navigator.clipboard.writeText(bookingUrl)
    toast({ title: 'Link Copied', ... })
  }}>
    <Link2 className="h-4 w-4 mr-2" />
    Copy {userProfile?.first_name}'s Link
  </Button>
)}
```

---

## Solution

Reuse the `SimpleScheduleInterviewSheet` component (already created) to enable direct interview scheduling from the job candidate profile.

---

## Files to Modify

### `src/components/candidates/CandidateProfileSheet.tsx`

**1. Add import (around line 53):**
```typescript
import { SimpleScheduleInterviewSheet } from './SimpleScheduleInterviewSheet';
```

**2. Add new state (after line 168):**
```typescript
// Simple schedule interview (not stage-specific)
const [simpleScheduleOpen, setSimpleScheduleOpen] = useState(false);
```

**3. Replace button (lines 1506-1521):**

Remove:
```tsx
{bookingUrl && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      navigator.clipboard.writeText(bookingUrl)
      toast({
        title: 'Link Copied',
        description: 'Your booking link has been copied to clipboard.'
      })
    }}
  >
    <Link2 className="h-4 w-4 mr-2" />
    Copy {userProfile?.first_name ? `${userProfile.first_name}'s` : 'My'} Link
  </Button>
)}
```

Replace with:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setSimpleScheduleOpen(true)}
>
  <Calendar className="h-4 w-4 mr-2" />
  Schedule Interview
</Button>
```

**4. Add sheet component (before closing `</SheetContent>`, around line 1740):**
```tsx
{/* Simple Schedule Interview Sheet (not stage-specific) */}
{candidateId && organizationId && candidate && (
  <SimpleScheduleInterviewSheet
    open={simpleScheduleOpen}
    onOpenChange={setSimpleScheduleOpen}
    candidateId={candidateId}
    candidateName={candidate.candidate_name || 'Candidate'}
    candidateEmail={candidate.email || ''}
    candidatePhone={candidate.phone}
    organizationId={organizationId}
  />
)}
```

---

## Technical Notes

- The `Calendar` icon is already imported (line 18)
- The existing `scheduleOpen` state (line 159) is used for stage-specific scheduling via `ScheduleInterviewSheet`
- The new `simpleScheduleOpen` state handles simple/standalone bookings
- Simple bookings are created with `job_id`, `job_candidate_association_id`, and `job_hiring_stage_id` set to `null`
- This allows users to quickly schedule calls without associating them to a specific hiring stage

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/candidates/CandidateProfileSheet.tsx` | Add import, state, replace button, add sheet component |

---

## Cleanup (Optional)

The following imports/hooks may become unused after this change:
- `useBookingConfig` (line 61) - only used for `bookingUrl`
- `useUserProfile` (line 62) - only used for `userProfile?.first_name` in the old button
- `Link2` icon (line 18) - only used in the old button

These can be removed for cleaner code, but are not strictly required for functionality.
