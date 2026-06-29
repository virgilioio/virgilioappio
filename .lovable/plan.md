
## Problem

In the Job Wizard → Job Posting step, the "Hero banner" uploader is cosmetic:
- It captures only the filename, never the file bytes.
- Nothing is uploaded to Supabase Storage.
- `PublicJobPosting` and `PublicCareersPage` do not read any banner field — so even if a URL existed, it would not render.

Result: users think they've branded their posting, but the live careers page only ever shows the brand-color gradient placeholder.

## Goal

When a user uploads a hero banner during job posting configuration (wizard or PostingSheet), the image is:
1. Uploaded to Supabase Storage on selection.
2. Persisted on the job posting.
3. Rendered as the hero on the public job page (with the brand-color gradient as the documented fallback).

## Plan

### 1. Storage

- Create a new public bucket `job-posting-banners` via `supabase--storage_create_bucket` (public, so the careers page can render the image without signed URLs).
- Add RLS on `storage.objects` so:
  - Authenticated members of the tenant can `INSERT/UPDATE/DELETE` objects keyed under `{tenant_id}/{posting_id}/...`.
  - `SELECT` is public (matches existing `careers-logos` pattern).
- File constraints enforced client-side: image/* only, max 5 MB, recommended 1600×480.

### 2. Data model

- No new column needed. Store the public URL inside the existing `job_postings.details` JSONB as `details.banner_url` (alongside `banner_name`, which we'll keep for the filename label).
- This mirrors how `brand_color`, `team_photos`, `culture_video`, and other posting branding fields are already stored.

### 3. Wizard upload UX (`JobPostingStep.tsx`)

- Replace the filename-only `onChange` with a real upload flow:
  - On file select, immediately upload to `job-posting-banners/{tenantId}/wizard-{uuid}/{filename}`.
  - Show inline progress state (spinner + filename) on the dashed tile.
  - On success, render the uploaded image inside the tile (replacing the gradient preview), store `bannerUrl` + `bannerName` in component state.
  - Provide a small "Remove" affordance (top-right of the tile) that clears state and deletes the storage object.
  - On validation/upload error, toast and keep the tile in the gradient state.
- Include `banner_url: bannerUrl || null` in the `details` payload sent to `createPosting`.
- After the posting is created in `savePosting`, optionally move the wizard temp object from `wizard-{uuid}/` to `{postingId}/` so storage stays tidy (best-effort; not blocking).

### 4. PostingSheet (post-creation editing)

- The existing PostingSheet that edits an already-created posting needs the same banner field so users can swap/remove the banner later. Reuse the same upload component.
- Path here is the final form: `{tenantId}/{postingId}/{filename}`.

### 5. Public rendering

- In `PublicJobPosting.tsx`, where the hero currently renders the brand-color gradient:
  - If `details.banner_url` exists, render the image as the hero background (cover, center) with a subtle dark overlay for text legibility.
  - Otherwise keep the current gradient fallback.
- In `PublicCareersPage.tsx` job cards, if a banner exists, use it as the card thumbnail; otherwise keep current gradient. (Optional polish — confirm before doing.)

### 6. Cleanup & guardrails

- When a posting is deleted, attempt to delete its banner objects (best-effort in the existing delete flow).
- Add an `image/*` accept + 5MB size check before upload.
- Show toast errors for storage failures rather than failing silently.

## Technical notes

- Reuse the same upload helper pattern already used by `careers-logos` to stay consistent.
- Keep the API surface of `JobPostingStep` save unchanged aside from the extra `banner_url` field in `details` — no DB migration required.
- Public URL format will be the standard Supabase public bucket URL, safe to embed directly in `<img>` and CSS `background-image`.

## Open question

Do you want the banner to also replace the placeholder thumbnail on **job cards in the public careers list**, or only on the individual job posting page? I'd default to "individual job page only" to keep the careers grid visually uniform, but happy to do both if you prefer.
