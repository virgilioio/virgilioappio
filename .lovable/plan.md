

# Add First-Click WhatsApp Template to CandidateCard (Pipeline View)

## What

The WhatsApp link on the pipeline CandidateCard currently opens a plain `wa.me` URL. It needs the same first-click template logic used in CandidateProfileSheet: on first click per association, resolve the workspace message template with placeholders and pre-fill it; on subsequent clicks, open plain.

## Changes

### `src/hooks/usePipelineActions.ts`
- Add `whatsapp_template_sent_at` to the `PipelineAssociation` interface
- Fetch it from `job_candidate_associations` select query (line 30)
- Map it into the result (line 68-81)

### `src/components/jobs/CandidateCard.tsx`
- Add `whatsapp_template_sent_at` to props, plus `jobId` (needed for placeholder resolution)
- Replace the simple `<a href={buildWhatsAppUrl(phone)}>` with an `onClick` handler that:
  1. Checks if `whatsapp_template_sent_at` is set or no template configured — if so, open plain `wa.me`
  2. Otherwise, fetch sender profile + job/org data, call `buildPlaceholderData` + `renderTemplate`, open `wa.me` with resolved text
  3. Update `job_candidate_associations.whatsapp_template_sent_at` and local state
- Import `renderTemplate`, `buildPlaceholderData` from `@/utils/templateUtils`, `useAuth` for user context
- The candidate data needed (name, email, phone, location) is minimal — we already have `candidateName` and `phone`; for full placeholder support we fetch candidate details on click (single lightweight query)

### `src/components/jobs/PipelineOverview.tsx`
- Pass `whatsapp_template_sent_at` and `jobId` props to CandidateCard from the association data

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePipelineActions.ts` | Add `whatsapp_template_sent_at` to interface + fetch + map |
| `src/components/jobs/CandidateCard.tsx` | Replace plain wa.me link with first-click template handler |
| `src/components/jobs/PipelineOverview.tsx` | Pass new props to CandidateCard |

