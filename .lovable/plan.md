# Wire "Create new job" to the JobWizard

Replace the "coming soon" toast with the existing `<JobWizard>` modal (same one used by `GlobalCreateButton`, `Jobs`, `JobDetail`).

## Changes

- **`LinkToJobBanner.tsx`** — add `wizardOpen` state. After clicking `+ Create new job` in the popover, close the popover and open `<JobWizard isOpen onClose>`. On wizard close, do nothing extra (banner stays; user can re-open popover and pick the freshly created job which will appear in the open-jobs list).
- **`LinkToJobDialog.tsx` → `LinkToJobPopoverContent`** — replace the inline `toast(...)` with a new `onCreateNew` prop, fired by the footer button. Banner wires it to `setWizardOpen(true)`.
- **`LinkToJobDialog.tsx` → `LegacyPickerInsideDialog`** (used by `SourcingProjectActions` "Change linked job") — same: surface a `onCreateNew` prop and have the dialog's root render the wizard too, so behavior is consistent across both entry points.

## Out of scope

- Auto-selecting the newly created job in the popover (would need wizard `onCreated(jobId)` callback wiring — leaving for a follow-up).
- Pre-filling the wizard from `project.job_spec_data` (there's already a separate `CreateJobFromProjectDialog` for that flow; that one stays as-is in the overflow menu).

## Files

- Edit `src/components/sourcing/LinkToJobBanner.tsx`
- Edit `src/components/sourcing/LinkToJobDialog.tsx`
