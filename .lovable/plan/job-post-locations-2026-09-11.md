# Job post locations

## Goal
Give every job post its own **Primary location** and **Additional locations**, matching job creation, and show all configured locations clearly on the public post.

## Implementation
1. **Add both fields to job-post creation**
   - Add the same Primary location input and pill-based Additional locations control used in job creation.
   - Seed both from the parent job, while keeping them editable for that individual post.
   - Save them in the post’s existing details payload.

2. **Update job-post editing**
   - Replace the current single “Location” field with Primary location plus Additional locations pills.
   - Load existing post values first, falling back to the parent job for older posts that do not yet have post-level location values.
   - Preserve all existing compensation, work-model, permissions, and publishing behavior.

3. **Update public job posts**
   - Fetch the parent job’s additional locations for backward-compatible fallback.
   - Resolve post-level primary/additional locations first, then parent-job values when absent.
   - In the right-side summary card, show Primary location and each additional location on its own line, followed by the existing Work model row.
   - Keep empty location rows hidden and ensure the header location summary remains consistent.

4. **Verify**
   - Check creation, editing, re-opening, and public rendering for posts with zero, one, and multiple additional locations.
   - Confirm existing posts continue to display their parent job’s locations without a data migration.

## Technical notes
- The post already has a flexible JSON details field, so no database schema migration is required.
- Expected files: `JobPostingStep.tsx`, `PostingSheet.tsx`, `PublicJobPosting.tsx`, and the public summary-row renderer if needed for multiline values.
