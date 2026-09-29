# Client pipeline — share Application review, Offers, Hired, and Rejected

## Outcome
- Expand the existing `/cp/:token` client pipeline so recruiters can share **Application review, Recruiting process, Job offers, Hired, and Rejected**. Suggested remains internal-only.
- Preserve the current **individual recruiting-stage selection**. The uploaded brief’s “from this stage onward” behavior will not replace it.
- Keep existing client links unchanged: all new sections start off, so currently live views continue showing only their selected recruiting stages.

## Build

### 1. Sharing settings and safe labels
- Add section switches to `job_pipeline_shares`: Application review, Offers, Hired, Rejected, plus an optional Rejection reasons display switch. Defaults stay off.
- Add an optional **Client label** to rejection reasons and support editing it in Settings.
- Public rejected rows will expose only `client_label`, falling back to **Not progressed**; candidate-declined reasons always display **Withdrew**. Internal reason names and notes never leave the server.
- Keep existing authenticated, workspace-scoped access rules. Anonymous visitors continue reading only through the token-validated Edge Function; no candidate or offer tables become publicly readable.

### 2. “What the client sees” setup card
- Replace the current Visible stages card with five section tiles matching the internal pipeline palette and order.
- Recruiting process stays always on; its existing stage chips remain independently selectable.
- Add three autosaving presets adapted to individual-stage selection:
  - **Shortlist only:** other sections off; select the third recruiting stage and every later recruiting stage, or the last stage when fewer than three exist.
  - **Active process:** Application review on; all recruiting stages selected; other sections off.
  - **Everything:** all four optional sections on; all recruiting stages selected.
- Show section counts, total visible candidates, selected section names, and a `Live · N sections` badge.
- Show the Rejection reasons toggle only while Rejected is shared, and update the internal-only list exactly as specified.

### 3. Public section data
- Extend `pipeline-public` with a strict, section-aware server serializer. It will return only shared sections and only fields needed by their visible columns.
- Reuse the same association classifications as the internal pipeline:
  - Application review from the application-review stage.
  - Offers from offer status or offer stage.
  - Hired from hired status.
  - Rejected from rejected status, including the furthest reached stage.
- Map offer states to client wording server-side and exclude terms, salary/package details, approvers, counter-offer data, owners, sources, notes, and internal rejection labels.
- Keep the current scheduled-first relevance ordering within recruiting stages and preserve browser-timezone formatting.

### 4. Public tabs and tables
- Keep the current recruiting board unchanged when it is the only shared section.
- When multiple sections are shared, add accessible section tabs for shared sections only; Recruiting process is the default.
- Use `/cp/:token?section=application|recruiting|offers|hired|rejected`; invalid or newly unshared values fall back to Recruiting without an error.
- Render Application review, Offers, Hired, and Rejected as read-only flat tables with the requested conditional Gio Fit, employer, status, and rejection-reason columns, plus section-specific empty states.
- Keep polling-based live updates. Turning off the active section returns the visitor to Recruiting on the next refresh.

### 5. Dossiers from every section
- Open every row in the existing shared dossier at `/cp/:token/:slug?section=...`, preserving the active section on Back and in previous/next navigation.
- Navigation stays within that section and follows its displayed row order.
- Application review keeps the current decision behavior when responses are enabled.
- Offers and Hired use their existing public banners with the actual displayed first name or initial.
- Add a public-only **Not progressing** dossier state for Rejected, with no decision buttons. Standalone `/d/:token` links remain deactivated after rejection.
- Retain Salary expectations in the public Summary stats when present, while continuing to strip Salary Alignment, salary weighting/mechanics, and salary validation questions server-side.

### 6. Internal sharing indicators
- Add an eye marker to each shared internal pipeline section tab, never Suggested.
- Extend the live strip to list optional shared sections and the total visible candidate count while retaining Preview.
- Update card/stage markers to reflect the existing individually selected recruiting stages.

## Technical details
- Database migration: add five boolean share fields and `rejection_reasons.client_label`; preserve all existing rows and grants/RLS.
- Update the pipeline share hook/types, rejection-reason hook/editor, client-view settings, internal section tabs/strip, public payload contracts, public section table, and dossier stage handling.
- Keep `/cp/` routing despite `/p/` references in the uploaded brief because `/p/` already belongs to legacy job-post links.
- Add focused serializer and section-state tests so unshared sections and sensitive fields cannot appear in anonymous responses.

## Verification
- Confirm existing live shares still expose only their selected recruiting stages after migration.
- Test every section alone and in combination, all three presets, individual stage toggling, empty sections, invalid/unshared query values, and turning a visible section off while open.
- Verify anonymous payloads contain no contact details, source/referrer, tags, files, activity, email, comments, offer terms, internal rejection reasons/notes, owners, or approval data.
- Verify Application decisions, Offer/Hired/Rejected dossier states, same-section navigation, standalone rejected dossier deactivation, salary expectation visibility, PDF output, desktop/mobile layout, and a clean build.
