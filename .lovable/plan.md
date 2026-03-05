

# Show Configured Approvers in Empty State

## What

When no approval request exists yet, instead of just showing the empty state message, display the configured approval chain approvers in a grayed-out vertical timeline below the message. This gives recruiters a preview of who will need to approve before they submit.

## How

**File: `src/components/candidates/CandidateOfferApprovals.tsx`**

1. Import `useOfferApprovalChain` to fetch the configured chain steps for the job
2. In the `!approvalRequest` empty state block, after the existing message, render the configured approvers in a vertical timeline using the same visual structure as the active approval timeline but with muted/grayed-out styling:
   - Muted circle icons (e.g., numbered or clock icon in `bg-muted`)
   - Approver name + role badge in `text-muted-foreground` / reduced opacity
   - Connecting vertical line in `bg-border` (same as existing)
   - Step order number shown
3. Only show this section if the chain is enabled and has steps; otherwise keep the current empty state as-is
4. Add a small label above the timeline like "Configured approval order" in muted text

**Layout:**
```text
┌─────────────────────────────────────┐
│    [gio face]                       │
│    No approval request yet.         │
│    Request approval from...         │
│                                     │
│    Configured approval order        │
│    ○─ 1. John Smith [Admin]         │
│    │                                │
│    ○─ 2. Jane Doe [Hiring Manager]  │
│    │                                │
│    ○─ 3. Bob Wilson [Recruiter]     │
│    (all grayed out / muted)         │
└─────────────────────────────────────┘
```

Single file change — only `CandidateOfferApprovals.tsx`.

