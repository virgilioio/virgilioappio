## What I verified

**Bug 1 — Custom application questions aren't saved.** The wizard's Job posting step (`src/components/jobs/wizard/JobPostingStep.tsx`, `savePosting` at L277–326) serializes the field builder state into a JSON blob on `job_postings.details.application_fields` and calls `createPosting({ title, description, details })`. The actual public posting + the PostingSheet read fields from the dedicated `job_posting_application_fields` table via `useJobPostingFields` (`SheetApplicationFormBuilder.tsx`, `public-submit-application`, `talent-questions`, etc.). Nothing inserts the wizard's custom rows into that table → custom questions disappear after creation.

**Bug 2 — "Publish to careers page immediately" toggle is cosmetic.** In `SummaryStep.tsx` L626–660 the four `ToggleRow`s in "On creation" only set `defaultOn`/`disabled` — no `checked`/`onChange`/state, and `JobWizard.tsx` never receives or acts on them. The posting is created via `useJobPostings.createPosting` which inserts into `job_postings` without touching `is_active`, so the posting row ends with whatever default `is_active` has (and even if `true`, public visibility on the careers page depends on the posting being marked published, not on this toggle).

Both reports are accurate.

---

## Plan

### 1. Persist wizard custom questions into `job_posting_application_fields`

Refactor `JobPostingStep.savePosting()` so that after `createPosting` returns the new posting id, we sync the builder's non-locked fields into the real table — the same shape `PostingSheet` writes.

```text
savePosting()
  ├─ createPosting(...)              → newPostingId
  └─ for each custom (non-locked) field f, in order:
       insert into job_posting_application_fields {
         posting_id: newPostingId,
         field_label: f.label,
         field_type: sharedTypeToDb(f.type),   // longtext→textarea, yesno→checkbox
         is_required: f.required,
         help_text: f.hint,
         field_config: f.fieldConfig ?? null,
         source: 'custom',
         display_order: index,
       }
       if f.type === 'select' && f.fieldConfig?.options → insert posting_field_select_options rows
```

Implementation notes:
- Add a helper `persistWizardFields(postingId, fields)` in `JobPostingStep.tsx` (or extract to `src/hooks/useJobPostingFields.ts` as `bulkCreateForPosting`) that mirrors `addCustomField` from `useJobPostingFields`.
- Keep writing the lightweight summary into `details.application_fields` for backward compatibility (other code paths read it for previews), but the table is the source of truth.
- Skip rows whose `id` starts with `core:` and any `locked` rows (those are the always-on core fields handled separately).
- On insert failure: surface a toast and return `false` so the wizard does not advance/finalize the posting in a half-saved state. If `createPosting` succeeded but field sync failed, leave the posting as draft and tell the user "Posting created, but custom questions failed to save — open the posting to retry."
- Backfill safety: ignore any pre-existing rows (this runs at create time, so the table is empty).

### 2. Wire the "On creation" toggles, and actually publish

Make the four `ToggleRow`s in `SummaryStep.tsx` controlled. Add four pieces of state on `JobWizard.tsx` (`publishImmediately`, `crossPost`, `openSourcing` — already exists as `autoSource` — and `notifySlack`) and pass `checked`/`onChange` props down to `SummaryStep`. The first one defaults to `true` only when `hasPosting`.

On Create:

```text
handleCreate (Summary step)
  1. saveJob()                       → jobId
  2. postingRef.current.savePosting() → creates posting + custom fields (Bug 1 fix)
  3. if (publishImmediately && hasPosting):
        update job_postings
          set is_active = true,
              published_at = now()
          where id = newPostingId
        ensure jobs.status = 'open'
  4. if (crossPost && hasPosting): enqueue cross-post job (out of scope for this fix — leave a TODO; do NOT silently lie)
  5. if (notifySlack): same — leave wired but TODO until Slack integration ships
  6. if (openSourcing): existing `autoSource` already creates the sourcing project — keep as-is
```

Concretely:
- Extend `useJobPostings.createPosting` (or add `publishPosting(id)`) with an optional `publish: boolean` argument that sets `is_active = true` and `published_at = now()` (add column if missing — check schema first; if not present, add migration `ALTER TABLE job_postings ADD COLUMN published_at timestamptz`).
- Update `JobPostingStep.savePosting()` signature to accept `{ publish: boolean }` and pass it to `createPosting`.
- In `JobWizard.tsx`, thread `publishImmediately` from `SummaryStep` into the call to `postingRef.current.savePosting({ publish: publishImmediately })`.
- After success, refresh `useJobPostings` and the careers page query cache.
- Verify `PublicCareersPage` / `PublicJobPosting` filtering: they should require `is_active = true` (and `published_at IS NOT NULL` if we adopt that column). Adjust the query/RLS read policy if it currently shows drafts or hides published rows.
- Disable the "Publish immediately" toggle (already done) and the cross-post toggle when `!hasPosting`. Keep helper copy honest: when a toggle's backend is not yet implemented, label it `Coming soon` and force it off instead of pretending it works.

### 3. QA checklist

- Create a job with posting + 2 custom questions (short text + select) → open `Job → Postings → Edit posting` and confirm both questions render with correct type, required flag, and select options.
- Open the public posting URL → custom questions appear in the application form; submitting stores them in `candidate_application_responses`.
- Toggle "Publish to careers page immediately" OFF → posting created with `is_active = false`; it does NOT appear on the public careers page; "Publish" button on the posting edit view works.
- Toggle ON (default) → posting created with `is_active = true`, `published_at` set, immediately visible on `/careers/...` and indexable per the existing Google for Jobs syndication logic.
- Re-open the wizard for an existing job (edit mode) → custom questions round-trip from the table back into the builder.

### Files touched

- `src/components/jobs/wizard/JobPostingStep.tsx` — persist custom fields after `createPosting`; accept `publish` flag.
- `src/components/jobs/wizard/SummaryStep.tsx` — controlled toggles, prop-driven.
- `src/components/jobs/JobWizard.tsx` — own toggle state, pass through to `savePosting`, post-create publish step.
- `src/hooks/useJobPostings.ts` — optional `publish` flag → set `is_active` / `published_at`.
- `src/hooks/useJobPostingFields.ts` — optional `bulkCreateForPosting(postingId, fields)` helper.
- Possible migration: `published_at` column on `job_postings` (only if not already present).

### Out of scope (flagged, not fixed in this pass)

- Real Slack notification on creation.
- Real cross-post-to-LinkedIn/WTTJ/ZipRecruiter pipeline. The toggle will be labeled "Coming soon" and disabled until the integration lands, so we never again ship a toggle that does nothing.
