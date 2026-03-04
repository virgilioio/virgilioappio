

# Add Dismiss Action for Email Tasks in Pending Tasks Widget

## Problem
Email tasks in the Pending Tasks card can only be dismissed by clicking through to the candidate profile. Users need a quick way to dismiss (mark as read) directly from the dashboard.

## Approach
Add a small "more" menu (three-dot `MoreHorizontal` icon) on email-type task items in `PendingActivities.tsx`. The menu will have a "Dismiss" option that calls `markEmailAsRead` without navigating away.

## Change — `src/components/dashboard/PendingActivities.tsx`

1. Import `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` and `MoreHorizontal` icon
2. For tasks where `activity.type === 'email'`, render a dropdown menu trigger (three-dot button) in place of or alongside the `ChevronRight` icon
3. The dropdown will have:
   - **"Mark as read"** — calls `markEmailAsRead.mutate(activity.emailId)` and stops propagation so the row click doesn't fire
   - **"Open"** — triggers the existing `handleActivityClick` navigation
4. Non-email task types (`scorecard`, `decision`) keep the current click-through behavior with no menu

The menu button will use `e.stopPropagation()` to prevent the parent button's `onClick` from firing when interacting with the dropdown.

