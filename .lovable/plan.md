

# Hide All "Create" Buttons on Mobile

## Problem
Mobile is primarily a consultation interface. Create/add buttons consume space and are unnecessary.

## Changes

| File | Change |
|---|---|
| `src/components/layout/Header.tsx` | Wrap `<GlobalCreateButton />` (line 265) in `<div className="hidden sm:block">` |
| `src/components/candidates/IndependentCandidateTable.tsx` | Add `hidden sm:inline-flex` to the "Add Candidate" button (line 367) |
| `src/components/candidates/CandidateTable.tsx` | Add `hidden sm:inline-flex` to the "Add Candidate" button (line 269) |
| `src/components/jobs/JobsTable.tsx` | Add `hidden sm:flex` to the "Create Job" button wrapper div (line 271) |
| `src/components/members/MembersTable.tsx` | Add `hidden sm:inline-flex` to the "Add Member" button (line 204) |
| `src/components/dashboard/QuickAccess.tsx` | Add `hidden sm:block` wrapper or return null on mobile for the whole card |

Six files, one-line class additions each.

