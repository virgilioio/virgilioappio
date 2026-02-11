

# Remember Last Rejection Settings

## Problem
When rejecting multiple candidates one after another, the user has to re-select the rejection reason and re-toggle the email switch each time. This adds unnecessary clicks for a repetitive workflow.

## Solution
Persist the rejection reason and send-email toggle to `localStorage` after each successful rejection. When the dialog opens next, initialize from those saved values instead of defaults.

**What gets remembered (per session / until cleared):**
- Rejection reason selection
- Send email toggle (on/off)

**What does NOT get remembered (unique per candidate):**
- Rejection notes (always starts blank)
- Email content, schedule, recipient (always fresh per candidate)

## Technical Details

### File: `src/components/candidates/RejectionDialog.tsx`

1. Define a localStorage key, e.g. `rejection-dialog-prefs`
2. On mount, read saved preferences and use them as initial state:
   - `rejectionReasonId` defaults to saved value or `undefined`
   - `sendEmail` defaults to saved value or `true`
3. On successful submission (inside `handleSubmit`, after `mutateAsync` succeeds), save the current `rejectionReasonId` and `sendEmail` to localStorage before resetting state
4. Remove the full reset of `rejectionReasonId` and `sendEmail` on success -- instead keep them (or re-read from storage) so the next open already has them

### File: `src/components/candidates/BulkRejectionDialog.tsx`

Apply the same pattern for consistency: read `rejectionReasonId` and `sendEmail` from the same localStorage key on mount, and save on successful bulk rejection.

### Storage shape

```typescript
interface RejectionPrefs {
  rejectionReasonId?: string;
  sendEmail: boolean;
}
// key: 'rejection-dialog-prefs'
```

No new files, no new dependencies, no database changes.

