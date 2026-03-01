
# Notification Center (Bell Icon in Header)

## Overview

Add a notification bell icon to the header that shows unread candidate emails. It uses the existing `usePendingActivities` hook which already handles job-scoping (restricted roles only see emails from their assigned jobs) and provides `markEmailAsRead`.

## What You'll See

- A bell icon in the header (next to the Sourcing Credits button), matching the same ghost button style
- A small red dot/badge when there are unread email notifications
- Clicking the bell opens a popover with a scrollable list of unread emails
- Each item shows: candidate name, email subject, job title, and relative timestamp
- Clicking a notification navigates to the candidate's profile and marks the email as read
- An empty state when no notifications are pending

## Visual Consistency

- Uses the same `Button variant="ghost"` pattern as the SourcingCreditIndicator
- `font-poppins` typography throughout
- `shadow-calendly` and `border-virgilio-border` on the popover (matching existing dropdowns)
- `text-virgilio-text` / `text-virgilio-muted` color tokens
- `bg-virgilio-purple/10` hover states on list items
- `ScrollArea` for the notification list
- `Badge variant="destructive"` for the unread count indicator
- Consistent icon sizing (`h-4 w-4` for trigger, `h-3.5 w-3.5` for list items)

## Technical Details

### New File: `src/components/layout/NotificationCenter.tsx`

- Import `usePendingActivities` hook -- filter results to `type === 'email'` only
- Render a `Popover` (with `modal={true}` per project memory for nested usage safety) with a `Bell` icon trigger
- Show a destructive badge with unread count when > 0
- Popover content: header label, `ScrollArea` with notification items, empty state
- Each item: `Mail` icon, candidate name (bold), subject snippet, job title badge, relative time
- On click: call `markEmailAsRead`, then `navigate(`/candidates/${candidateId}`)`
- "Mark all as read" button at the bottom when there are notifications

### Modified File: `src/components/layout/Header.tsx`

- Import `NotificationCenter`
- Add `<NotificationCenter />` between the `SourcingCreditIndicator` and the Workspace Switcher (line ~256)

### Files Changed

| File | Change |
|------|--------|
| `src/components/layout/NotificationCenter.tsx` | New component |
| `src/components/layout/Header.tsx` | Add NotificationCenter to header actions |
