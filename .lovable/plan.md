

## Current behavior (the bug)

`useJobSourcingProject` calls `.maybeSingle()` on `sourcing_projects` filtered by `job_id` + `status='active'`. If a job has 2+ active sourcing projects:
- Supabase returns a "more than one row" error
- The hook returns `null`
- The Search shortcut in `JobDetailFloatingSidebar` **disappears entirely**

So right now, the more sourcing projects a job has, the *less* discoverable they are from the job. That's backwards.

## Proposed fix — Popover menu when there are multiple

Mirror the pattern Ashby/Greenhouse use for "linked entities" — one entry point in the rail, expanded into a list when there's more than one.

**Single project (unchanged behavior):**
Click the Search icon → navigate directly to `/find/{projectId}`. Tooltip shows the project name.

**Multiple projects:**
Click the Search icon → opens a Popover anchored to the right of the rail, listing all active sourcing projects for the job. Each row shows:
- Project name
- Small meta line: candidate count + "Updated Xd ago" (uses existing concise time format)
- Click → navigates to `/find/{projectId}`

A small numeric badge (e.g. "3") sits on the icon when count > 1, so the user knows there are multiple without opening it.

**Zero projects:** icon is hidden (current behavior preserved).

## Why a popover (not a dropdown / not a second sidebar item)

- Keeps the floating rail visually clean — still one circular icon, consistent with the rest
- Popover anchored `side="right"` matches the existing tooltip pattern in the same component
- Avoids navigating to a "list page" which would be one extra click for the common case
- A numeric badge gives instant signal that more than one exists

## Implementation

### 1. `src/hooks/useJobSourcingProject.ts` — return a list
- Replace `.maybeSingle()` with a normal select, ordered by `updated_at desc`
- Return `{ projects: [{id, name, total_candidates, updated_at}], isLoading }`
- Keep `sourcingProjectId` / `sourcingProjectName` as derived getters of the first item for any other consumers (none found, but safe)

### 2. `src/components/jobs/JobDetailFloatingSidebar.tsx`
- Change prop from `sourcingProjectId` to `sourcingProjects: Array<{id, name, total_candidates, updated_at}>`
- If `length === 0` → render nothing (unchanged)
- If `length === 1` → render existing button, direct navigate (unchanged)
- If `length > 1` → wrap the Search button in a `Popover`:
  - `PopoverTrigger`: same circular icon + small absolute-positioned count badge (top-right, `bg-foreground text-background`, w-4 h-4, rounded-full, text-[10px])
  - `PopoverContent side="right" align="start"`: vertical list of project rows, each a button that navigates and closes the popover

### 3. `src/pages/JobDetail.tsx`
- Update the destructure from `useJobSourcingProject` to pass `projects` through

## Files touched

1. `src/hooks/useJobSourcingProject.ts` — return list instead of single
2. `src/components/jobs/JobDetailFloatingSidebar.tsx` — popover + badge for multi case
3. `src/pages/JobDetail.tsx` — pass new prop shape

No DB, no edge functions, no schema changes. ~50 lines of UI.

