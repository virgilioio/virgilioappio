# Promote LinkedIn Profile from core field to smart field

## Answer
Yes. `LinkedIn Profile` is currently hardcoded as a core field in `useCoreFields.ts` (locked at the top of every application form, alongside Resume / Name / Email / Phone). The smart-field registry already defines a `linkedin` smart field (`SMART_FIELDS` in `ApplicationFormBuilder.tsx`), and the candidates table already has a dedicated `candidates.linkedin_url` column — so we can drop it from the core list and let it behave like any other smart field (optional, removable, reorderable, with a "Syncs to profile" badge).

## Scope
Frontend + light data-mapping. No DB schema change. Apply consistently across:
- Wizard Step 4 application form (`JobPostingStep.tsx` / `ApplicationFormBuilder.tsx`)
- Posting Setup sheet (`SheetApplicationFormBuilder.tsx`)
- Public application form renderer (`PublicJobPosting.tsx` / `CoreFieldsRenderer.tsx`)
- Candidate application responses view (`CandidateApplicationResponses.tsx`)
- Submission pipeline that writes to `candidates.linkedin_url`

## Changes

1. **Remove LinkedIn from core fields**
   - `src/hooks/useCoreFields.ts`: delete the `linkedin_url` entry from `CORE_FIELDS`. Core list becomes Resume, Full Name, Email, Phone (all still locked / required-by-Gio).

2. **Keep LinkedIn as a smart field**
   - `SMART_FIELDS` already exposes `{ id: 'sf_linkedin', label: 'LinkedIn', type: 'linkedin' }` — no change. It will now appear in the "+ Add question → Smart fields" menu like the others, with the "Syncs to profile" badge, optional toggle, and drag-to-reorder.

3. **Profile sync on submit**
   - In the public application submit handler, when a posting field of type `linkedin` is present, write its value to `candidates.linkedin_url` (same pattern already used for other smart fields that sync to profile).
   - If a posting has no LinkedIn field configured, `linkedin_url` stays null — that is the intended consequence of making it optional.

4. **Backfill for existing postings**
   - Existing postings that relied on the implicit core LinkedIn field will simply stop showing it. That is acceptable (it was optional), but to preserve continuity we will: on the first load of the posting builder, if the posting was created before this change AND has no `linkedin` posting field, auto-insert one as a smart field (non-locked, optional). One-time, idempotent, client-side — no migration needed.

5. **Candidate detail view**
   - `CandidateApplicationResponses.tsx`: render LinkedIn answers from posting fields rather than from the core block (it already iterates posting fields generically, so this should be a no-op once core entry is removed — verify).

## Out of scope
- Schema changes to `candidates` or `posting_fields`.
- Changing other core fields.
- Auto-enriching LinkedIn data (separate feature).

## Acceptance
- Wizard Step 4 and Posting Setup sheet show only 4 locked core rows (Resume, Name, Email, Phone). LinkedIn appears under "+ Add question → Smart fields → LinkedIn", with the "Syncs to profile" badge.
- Adding LinkedIn, submitting an application on the public page, and opening the candidate writes the URL to `candidates.linkedin_url` and shows it on the profile.
- Existing postings still display a LinkedIn field (auto-inserted as smart, optional) on first edit.
