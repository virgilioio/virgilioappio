# Sourcing project — linked-to-job state

Mirror the screenshot for projects that **are** linked to a job. Three focused changes:

## 1. Replace yellow banner with a green "Linked to job" strip

New component `src/components/sourcing/LinkedJobStrip.tsx`:

- Slim single-line bar (32–36px), `bg-emerald-50` + `ring-1 ring-emerald-200/60`, rounded-lg.
- Left: link icon in an emerald tile + label
  `Linked to job <Job title> · <Department> · collected candidates drop into the Sourced stage automatically.`
  (Job title is bold; the trailing sentence is `text-text-secondary`.)
- Right: two ghost buttons — `Open job` (↗ icon, navigates to `/jobs/:id`) and `Unlink` (chain-break icon, calls `onUnlink`).
- Pulls job title + department from `project.jobs` (already selected in `useSourcingProject`). Falls back to "this job" if missing.

`CandidatesTab.tsx` change (inside the banner zone):
```tsx
{isLinked ? (
  <LinkedJobStrip
    jobId={project.job_id!}
    jobTitle={project.jobs?.title}
    department={project.jobs?.department_name /* or organizations.name */}
    onUnlink={() => onLinkToJob?.('')} // see §1a
  />
) : (
  onLinkToJob && <LinkToJobBanner onLinkToJob={onLinkToJob} currentJobId={project.job_id} />
)}
```

### 1a. Unlink wiring

`SourcingProjectView.handleLinkToJob` already updates `sourcing_projects.job_id`. Extend it to accept empty string / null and run an `UPDATE … SET job_id = null`, then toast "Project unlinked". No new hook needed.

## 2. Verify bulk-select column + black bulk bar

Both already exist in `SourcingCandidateTable.tsx`. QA pass only:

- Confirm the checkbox column header + per-row checkbox render at all densities.
- Confirm the dark bulk bar shows `X selected · Select all N` in white (previous fix), with `Collect`, `Save for later`, `Not a fit`, and a close `×`. No code change unless something regressed.

## 3. Preview vs Collected card polish

Already differentiated via `isCollectedApollo` / `isApolloPreview`. Tighten to match screenshot:

- **Preview rows**: show a small "🔒 lock" before the email and render the email value as a redacted bar (`bg-text-tertiary/15 rounded w-32 h-3 inline-block`). Primary action button is `Reach out` only (no "Add to job"), matching the locked state. Badge stays `Preview`.
- **Collected rows**: full email/phone visible, primary action `Add to job` (already wired, label already conditional on `jobId`). Badge stays `Collected`, plus the existing `In Sourced` status pill when applicable.

These are presentational tweaks inside the existing row renderer — no new components.

## Files touched

- `src/components/sourcing/LinkedJobStrip.tsx` (new)
- `src/components/sourcing/CandidatesTab.tsx` (swap banner based on `isLinked`)
- `src/components/sourcing/SourcingProjectView.tsx` (allow unlink in `handleLinkToJob`)
- `src/components/sourcing/SourcingCandidateTable.tsx` (preview lock/redact + action gating)

## Out of scope

- No backend, RLS, or scoring changes.
- No edits to the results header, AI summary banner, tabs, toolbar, or pagination (shipped in prior turn).
