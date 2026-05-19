# Make the core LinkedIn Profile field a Core Smart Field

## Current behavior
- `LinkedIn Profile` is a locked core field defined in `src/hooks/useCoreFields.ts` and rendered on every public application form.
- On submit (`supabase/functions/public-submit-application/index.ts`):
  - **New candidate:** `linkedin_url` is written to `candidates.linkedin_url` on insert (line 240). ✅ syncs
  - **Existing candidate re-applying:** only the *custom* smart `linkedin` field (sent as `linkedin_sync`) updates the profile (line 370). The core `linkedin_url` is ignored on update. ❌ does not sync
- In the builder UI (Wizard Step 4 + Posting Setup sheet), the core LinkedIn row is **not** marked as a smart field — no "Syncs to profile" badge, no lilac smart styling.

## Goal
Keep LinkedIn as a locked, default core field on every posting, but elevate it to a **Core Smart Field**: visually badged as "Syncs to profile" and reliably writing to `candidates.linkedin_url` for both new and returning candidates.

## Changes

### 1. Mark the core LinkedIn field as smart (UI)
- `src/hooks/useCoreFields.ts`: add an `is_smart: true` flag (and reuse the existing `linkedin` `FieldType`) on the `linkedin_url` core entry. Other core fields stay non-smart.
- `src/components/jobs/postings/SheetApplicationFormBuilder.tsx`: when synthesizing locked core rows, set `isSmart: true` for the LinkedIn row so it inherits the existing smart styling (lilac icon tile, "Syncs to profile" badge) already implemented in `ApplicationFormBuilder.tsx`.
- `src/components/jobs/wizard/JobPostingStep.tsx`: same treatment for the wizard's locked LinkedIn core row, so wizard and sheet stay identical.
- Locked + required toggles continue to behave as today (locked stays locked, required stays as configured).

### 2. Always sync LinkedIn to the candidate profile (backend)
- `supabase/functions/public-submit-application/index.ts`:
  - When `body.linkedin_url` is present, also use it as the sync source for **existing** candidates (today only `body.linkedin_sync` triggers the update at line 370).
  - Simplest fix: in the existing-candidate update block, coalesce `body.linkedin_sync ?? body.linkedin_url` and update `candidates.linkedin_url` if a normalized URL is produced and the current value is empty or differs.
  - Keep the new-candidate insert path unchanged (already writes `linkedin_url`).
  - Same URL normalization (`https://` prefix, 512-char cap) as today; reuse the helper.

### 3. Public form payload (no shape change)
- `src/pages/PublicJobPosting.tsx` already sends `linkedin_url` in the submit body — no change needed. The optional `linkedin_sync` path stays for custom smart-field setups; both routes now converge in the edge function.

## Out of scope
- Removing or reordering other core fields.
- Schema changes (`candidates.linkedin_url` and `social_profiles` already exist).
- LinkedIn auto-enrichment (the existing `enrich-by-linkedin` invocation is already triggered for new candidates and is untouched here).
- Backfilling historical applications.

## Acceptance
- Wizard Step 4 and Posting Setup sheet show LinkedIn as a locked core row with the **"Syncs to profile"** badge and smart-field styling, identical in both surfaces.
- Submitting a public application as a **new** candidate writes the URL to `candidates.linkedin_url` (already works, verified unchanged).
- Submitting as an **existing** candidate (same email re-applying) updates `candidates.linkedin_url` when the form value is non-empty.
- No regression for postings that also configured a custom `linkedin` smart field — that path keeps working via `linkedin_sync`.
