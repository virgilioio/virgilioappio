# Dossier · LinkedIn icon next to the candidate's name

Add the same LinkedIn icon the in-job candidate profile shows next to the hero name to both dossier surfaces: the internal Gio Fit tab and the public client dossier link. Clicking opens the candidate's LinkedIn profile in a new tab. No behavior changes otherwise.

## 1. Internal dossier (Gio Fit tab)

`src/components/candidates/insights/CandidateInsightsTab.tsx`

- In the dossier header, next to the candidate name heading (the `!suggested` branch, ~line 424), render an icon button when `candidate?.linkedin_url` exists.
- Match the in-job hero treatment exactly (`ProfileHeroCard.tsx`): 28×28 rounded button, muted icon color that deepens on hover, subtle hover background, `aria-label="Open LinkedIn profile"`, `LinkedInFilled` icon at 16px, opens `ensureAbsoluteUrl(linkedin_url)` in a new tab with `rel="noopener noreferrer"`.
- Suggested-candidate dossiers are untouched (their header hides the name line).
- No PDF export change — the exported document has no clickable links and the request is about the on-screen dossier.

## 2. Public client dossier (`/d/:token`)

- `supabase/functions/dossier-public/index.ts`: add `linkedin_url` to the candidate column list (currently `candidate_name, role_current, ... skills`) and include it in the emitted `candidate` payload object. Payload-only change; no schema migration.
- `src/pages/PublicDossier.tsx`: add `linkedin_url: string | null` to the `PublicDossierPayload.candidate` type.
- `src/components/public/PublicDossierBody.tsx`: in the masthead, render the icon inline after the name (and its period) when `candidate.linkedin_url` exists — same muted LinkedIn mark, opens the profile in a new tab with `noopener noreferrer`, matching the page's inline-style idiom. Hidden when the candidate has no LinkedIn URL saved.

## 3. Verification

- Typecheck and build clean.
- Redeploy `dossier-public` and curl the live public dossier token to confirm `candidate.linkedin_url` appears and the page renders the icon.
- No authenticated Playwright checks (external unmanaged Supabase).
