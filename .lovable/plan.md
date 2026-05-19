# Add Delete Job action to the Jobs list

Surface a permanent **Delete** action in the Jobs list, gated to Platform Admins, Workspace Owners, and Workspace Admins.

## Scope

- `src/pages/Jobs.tsx`
- `src/components/jobs/JobsTable.tsx`

No backend, RLS, or hook changes — `useJobs.deleteJob` and the `canDeleteJobs` permission (already restricted to `isPlatformAdmin || isWorkspaceOwner || isAdmin`) are already in place. Platform admins go through the `admin-operations` edge function, others through direct delete under existing RLS.

## UX

In the row action menu (kebab) of `JobsTable`, after the existing **Archive** item, add:

- Divider
- **Delete job** item (destructive styling, Trash2 icon), wrapped in `<PermissionGate permission="canDeleteJobs">`

Order in menu: View → Edit → — → Archive → Delete job (delete is the LAST item, after a divider — per dropdown style guide).

Clicking **Delete job** opens a confirmation `AlertDialog` (separate from the existing Archive dialog) with:

- Title: "Delete job permanently?"
- Body: "This will permanently remove the job, its postings, and detach related candidates. This action cannot be undone."
- Cancel + destructive **Delete job** action (`variant="dangerSolid"` on the action button equivalent).

On confirm → call `deleteJob(id)` from `useJobs`, close dialog, toast handled by the hook.

## Implementation steps

1. **`Jobs.tsx`**
   - Destructure `deleteJob` from `useJobs()`.
   - Add `deleteJobId` state + `handleDelete(id)` + `handleConfirmDelete()`.
   - Pass `onDelete={handleDelete}` to `<JobsTable>`.
   - Render a second `<AlertDialog>` bound to `deleteJobId` with destructive confirm.

2. **`JobsTable.tsx`**
   - Extend `JobsTableProps` with `onDelete: (id: string) => void`.
   - Import `Trash2` from lucide-react.
   - In the action `DropdownMenuContent`, append after the Archive `PermissionGate`:
     ```tsx
     <PermissionGate permission="canDeleteJobs">
       <DropdownMenuSeparator />
       <DropdownMenuItem
         onClick={(e) => { e.stopPropagation(); onDelete(job.id) }}
         className="text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
       >
         <Trash2 className="h-3.5 w-3.5" /> <span>Delete job</span>
       </DropdownMenuItem>
     </PermissionGate>
     ```

## Out of scope

- Bulk delete from the table toolbar.
- Soft-delete / restore flow (archive already covers that).
- RLS / edge function changes — already configured.
- Changes to job detail page (this plan only covers the Jobs list).
