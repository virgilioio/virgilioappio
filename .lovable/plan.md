

# Billing Audit: Aligning Seat Counting with New Role Architecture

## What Already Works

1. **`update-seat-quantity` edge function** — calls `get_tenant_billable_seat_count` RPC and syncs to Stripe. Pipeline is correct.
2. **`create-checkout` edge function** — uses `get_tenant_billable_seat_count` to set initial quantity. Correct pipeline.
3. **`check_seat_limit`** — calls `get_tenant_billable_seat_count` internally. Pipeline is correct.
4. **`get-billing-period-usage`** — calls `get_tenant_billable_seat_count`. Correct pipeline.
5. **Stripe sync flow** — seat quantity updates propagate correctly through `update-seat-quantity`.

## What Is Broken

The core problem: **`get_tenant_billable_seat_count` only counts admins + workspace_owners**. It does NOT count members who are recruiters on jobs. After the recent migration, the function body is:

```sql
AND (m.user_type = 'workspace_owner' OR (m.user_type = 'member' AND m.system_role = 'admin'));
```

This misses users with `system_role = 'member'` who have `role = 'recruiter'` in `job_assignments`. These users should be paid seats.

### Full list of issues:

| Location | Problem |
|---|---|
| **`get_tenant_billable_seat_count` (DB function)** | Only counts admins. Must also count members with any recruiter job assignment. |
| **`MembersTab.tsx` (line 37-40)** | `paidMembers` filter only checks `system_role === 'admin'`. Misses recruiter-assigned members. |
| **`useSeatsPreview.ts` (line 22)** | `isBillableRole = roleToAdd === 'admin'` — cannot predict if a new member will be assigned recruiter. Less critical but misleading. |
| **`useMembers.ts` (line 283, 522)** | `isBillableRole = data.system_role === 'admin'` — same issue. A new member invited as `system_role = 'member'` who gets assigned recruiter on a job is billable but skips seat check. |
| **`isPayingRole` in `MembersTab.tsx` (line 32)** | Unused but wrong — only checks `'admin'`. |
| **No trigger on `job_assignments`** | When a member gets assigned `role = 'recruiter'` on a job, nothing triggers a seat recount + Stripe sync. |

## Recommended Billing Logic

```
paid_seat = user WHERE:
  (system_role = 'admin')
  OR (has at least one row in job_assignments with role = 'recruiter')

free_collaborator = everyone else (only hiring_manager/interviewer assignments)
```

## Implementation Plan

### 1. Fix `get_tenant_billable_seat_count` (DB migration)

Update the SQL function to join `job_assignments` and count users who are admin OR have any recruiter assignment:

```sql
SELECT COUNT(DISTINCT m.user_id) INTO cnt
FROM public.members m
JOIN public.organizations o ON o.id = m.organization_id
WHERE o.tenant_id = tenant_id_param
  AND m.user_status = 'active'
  AND m.user_type NOT IN ('platform_admin', 'guest')
  AND (
    m.user_type = 'workspace_owner'
    OR m.system_role = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.job_assignments ja
      WHERE ja.user_id = m.user_id AND ja.role = 'recruiter'
    )
  );
```

### 2. Add trigger on `job_assignments` for seat sync

Create a DB function + trigger that fires on INSERT/DELETE/UPDATE of `job_assignments` when `role = 'recruiter'`. It should call `pg_notify` or update a `seat_recount_needed` flag. Since the seat sync goes through the `update-seat-quantity` edge function (which needs Stripe), the simplest approach is:
- Add a `last_seat_recount_at` timestamp to `tenant_subscriptions`
- The frontend already refetches seat data periodically (every 60s via `useBillingStatus`)
- Add a lightweight client-side hook that calls `update-seat-quantity` when seat count changes

Alternatively (simpler): just ensure the existing `syncSeatsAfterChange()` is called from the frontend when job assignments change (in `useStageInterviewerAssignments.ts` and `MemberJobAssignmentsDialog.tsx`).

### 3. Frontend: Fix `MembersTab.tsx` paid/collaborator split

Create a helper hook `useIsBillableMember(userId)` or fetch job assignments in bulk to determine which members are paid. Update `paidMembers` and `collaboratorMembers` filters:

```ts
const paidMembers = members.filter(m =>
  m.system_role === 'admin'
  || m.user_type === 'workspace_owner'
  || recruiterUserIds.has(m.user_id)
)
const collaboratorMembers = members.filter(m => !paidMembers.includes(m))
```

This requires a single query to `job_assignments` where `role = 'recruiter'` to get the set of recruiter user IDs.

### 4. Frontend: Fix `useSeatsPreview.ts`

Update to accept job role context. When inviting a member who will be assigned recruiter, the preview should show billing impact. Since role assignment happens after invitation, this is informational — add a note in the invite UI: "This user will become a paid seat when assigned as a recruiter on a job."

### 5. Frontend: Fix `useMembers.ts` seat check

Update `isBillableRole` logic at lines 283 and 522 to also consider if the member has recruiter assignments. For new invitations (no assignments yet), keep current behavior — the seat recount will happen when they're assigned recruiter.

### 6. Sync seats on job assignment changes

In the two places where job assignments are modified:
- `MemberJobAssignmentsDialog.tsx` (bulk assign/unassign)
- `useStageInterviewerAssignments.ts` (stage-level assignment)

After mutations, call `update-seat-quantity` edge function to sync Stripe if a recruiter was added/removed.

### Summary of Changes

| Type | File/Location | Change |
|---|---|---|
| DB Migration | `get_tenant_billable_seat_count` | Add recruiter job assignment check |
| Frontend | `MembersTab.tsx` | Fetch recruiter user IDs, fix paid/collaborator split |
| Frontend | `useSeatsPreview.ts` | Update billable role logic |
| Frontend | `useMembers.ts` | Update isBillableRole checks |
| Frontend | `MemberJobAssignmentsDialog.tsx` | Call seat sync after recruiter assignment changes |
| Frontend | `useStageInterviewerAssignments.ts` | Call seat sync after recruiter assignment |

No pricing copy changes needed. No new seat types. No schema changes beyond the function update.

