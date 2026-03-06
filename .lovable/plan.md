

# Scope Upcoming Activities and Hide Stale Candidates for HM/Interviewers

## Problem
1. **Upcoming Activities**: Hiring managers and interviewers currently see bookings for all assigned jobs. They should only see interviews **where they are the interviewer** (`interviewer_id = user.id`), not all bookings across their assigned jobs. Reminders should stay filtered to own + assigned jobs (current behavior is fine).
2. **Stale Candidates**: This widget is an operational/recruiter concern. HMs and interviewers don't need it.

## Changes

### 1. `src/hooks/useScheduledBookings.ts` — Tighten booking filter for restricted viewers

Currently (line ~158-160), members with assigned jobs see bookings where they're the interviewer **OR** the booking is for any of their assigned jobs. For restricted viewers (HM/interviewer), we should only show bookings where `interviewer_id = user.id`.

The hook receives `permissions` as a parameter. We need to add a check: if the user is a restricted role (not admin, not workspace owner, not platform admin, and `isMember` is true with `system_role = member`), filter strictly by `interviewer_id`.

Change the filter logic around lines 156-164 to:
- If admin/owner/platform_admin → see all tenant bookings
- If restricted member (HM/interviewer) → only `interviewer_id.eq.${user.id}`
- If regular member (recruiter) → current behavior (interviewer OR assigned jobs)

### 2. `src/pages/Dashboard.tsx` — Conditionally hide `<StaleCandidates />`

Import `useUserJobRoles` (already imported) and use the `isPrivileged` / `hasRecruiterRole` flags to conditionally render the `StaleCandidates` component. Only show it when the user is privileged or has a recruiter role — same pattern already used for `showSourcingPanel`.

Wrap `<StaleCandidates />` (line 63) with `{(isPrivileged || hasRecruiterRole) && <StaleCandidates />}`.

## Summary
- Two files changed: `useScheduledBookings.ts` and `Dashboard.tsx`
- HM/Interviewers see only their own interviews in Upcoming Activities
- Stale Candidates card hidden entirely for HM/Interviewers

