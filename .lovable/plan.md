
# Add Sourcing Project Shortcut to Job Floating Sidebar

## What Changes

When a job has a linked sourcing project, a new icon button (Search/Telescope icon) appears at the bottom of the floating sidebar pill, visually separated by a thin divider line. Clicking it navigates directly to `/find/<projectId>`.

```text
  ┌───────┐
  │  📊   │  Job Dashboard
  │  👥   │  All Candidates
  │  📋   │  Pipeline
  │  ⚙️   │  Job Setup
  │ ───── │  divider
  │  🔍   │  Sourcing Project (link out)
  └───────┘
```

The icon only appears when a sourcing project is linked — otherwise the sidebar looks exactly as it does today. Since this navigates away from the job (to `/find`), it uses `useNavigate` rather than `onTabChange`.

## Technical Details

### 1. Query sourcing project by job ID

Create a small hook `useJobSourcingProject(jobId)` that queries:
```sql
SELECT id, name FROM sourcing_projects WHERE job_id = :jobId AND status = 'active' LIMIT 1
```
Returns `{ sourcingProjectId, sourcingProjectName, isLoading }`.

### 2. Update `JobDetailFloatingSidebar`

- Accept new optional prop `sourcingProjectId?: string`
- If present, render a divider (`<div className="w-6 border-t border-border" />`) after the nav tabs
- Below divider, render a button with `Search` icon that calls `navigate(\`/find/${sourcingProjectId}\`)`
- Tooltip: "Sourcing Project"
- Style: same circular button as others, but no active state (it's always a link-out)

### 3. Wire it up in `JobDetail.tsx`

- Import and call `useJobSourcingProject(id)` 
- Pass `sourcingProjectId` to `JobDetailFloatingSidebar`

## Files Modified

1. **`src/hooks/useJobSourcingProject.ts`** — New hook querying `sourcing_projects` by `job_id`
2. **`src/components/jobs/JobDetailFloatingSidebar.tsx`** — Add sourcing shortcut button with divider
3. **`src/pages/JobDetail.tsx`** — Wire the hook and pass prop to sidebar
