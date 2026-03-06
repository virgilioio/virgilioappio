

# Add Role Differentiation to Job Assignments

## Overview

Add a `job_assignment_role` column to the `job_assignments` table with three values: `recruiter`, `hiring_manager`, `interviewer`. When assigning a user to a job, the assigner must select which role that person plays on this specific job. Multiple recruiters per job are allowed.

## Database Changes

### Migration

```sql
-- Create enum type
CREATE TYPE public.job_assignment_role AS ENUM ('recruiter', 'hiring_manager', 'interviewer');

-- Add column with default 'recruiter' (so existing assignments get a role)
ALTER TABLE public.job_assignments 
  ADD COLUMN role job_assignment_role NOT NULL DEFAULT 'recruiter';
```

Existing assignments will default to `recruiter`. No data loss.

## Frontend Changes

### 1. `src/hooks/useJobAssignments.ts`

- Add `role` field to `JobAssignment` interface
- Add `role` field to `CreateJobAssignmentData` interface
- Include `role` in the insert payload when assigning
- Add an `updateAssignmentRole` mutation to change a user's role after assignment

### 2. `src/components/jobs/JobAssignmentsPanel.tsx`

- Add a role selector (Select/RadioGroup) next to the user picker in the "Add User Assignment" form, with options: Recruiter, Hiring Manager, Interviewer
- Default selection: Recruiter
- In the "Current Assignments" list, show the **job role** badge (instead of or alongside the org-level member role badge)
- Add ability to change an assigned user's role inline (dropdown on each row)

### 3. `src/integrations/supabase/types.ts`

This file auto-updates from the DB schema, so the new `role` column and enum will appear after migration.

## Summary

| File | Change |
|------|--------|
| DB migration | Add `job_assignment_role` enum + `role` column to `job_assignments` |
| `useJobAssignments.ts` | Add `role` to interfaces, insert, and add `updateAssignmentRole` |
| `JobAssignmentsPanel.tsx` | Add role selector on assign, show job role badge, inline role editing |

