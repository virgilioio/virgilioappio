

# Add Scheduled/Sent Email Indicator to Rejection Banner

## Current State

The app fetches `rejectionEmailScheduledFor` and `rejectionEmailSentAt` from the database in `CandidateProfileSheet`, but **neither value is ever displayed**. The `RejectionStatusBanner` only shows rejection date, reason, notes, and a Reactivate button. There is no visual indicator anywhere that a rejection email was sent or is scheduled.

## Fix

Add email status info to the `RejectionStatusBanner` — a small inline indicator below the existing rejection details:

- **Scheduled**: `Clock` icon + "Rejection email scheduled for Mar 25, 2026 at 9:00 AM" in a subtle amber/yellow tone
- **Sent**: `Mail` icon + "Rejection email sent on Mar 24, 2026" in a subtle green/white tone  
- **Neither**: No extra line shown (current behavior preserved)

This is the natural place since users already look at this banner when reviewing rejected candidates.

## Changes

| File | Change |
|------|--------|
| `src/components/candidates/RejectionStatusBanner.tsx` | Add optional `rejectionEmailScheduledFor` and `rejectionEmailSentAt` props; render inline status line |
| `src/components/candidates/CandidateProfileSheet.tsx` | Pass `rejectionEmailScheduledFor` and `rejectionEmailSentAt` to `RejectionStatusBanner` |

