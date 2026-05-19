# Application Submitted screen — redesign to match reference

Replace the current small "Application Submitted" dialog with a full-page confirmation screen on the public job posting, matching the attached reference (`43_Application_submitted.png`). The new screen reuses the same Careers top bar + footer chrome already wrapping the public posting, so the candidate stays inside the company's branded experience.

## What the candidate sees

1. **Hero block** (centered)
   - Soft mint circle with a checkmark icon
   - A "Reference" pill chip next to it showing the application reference ID (e.g. `DES-2026-014-LP-9821`)
   - Large headline: `Got it, {FirstName} — thanks.` with the trailing purple period (reuses `StyledPageTitle` styling: Poppins, tracking-page-title, purple `.`)
   - Sub-line: `Your application for {RoleName} is in. We sent a confirmation to {email}.`

2. **"What happens next" card** — single white card, rounded, hairline border. Vertical timeline with 4 steps connected by a faint line:
   - **1. Application received** — green filled circle with check · `Just now · {ReferenceID}` · right-aligned check glyph
   - **2. Recruiter review** — purple filled circle with `2` · "Maya from our team will read every word — promise." · right-aligned `Within 48h` in purple
   - **3. Intro chat** — muted outline circle `3` · "If there's a fit, we'll send 3 calendar slots within 24h of the reply." · right-aligned `~ next week` muted
   - **4. Decision** — muted outline circle `4` · "Whichever way it goes, you'll hear from us with notes. We don't ghost." · right-aligned `~ 2–3 weeks` muted

3. **Two side-by-side action cards** (2-column grid, stack on mobile)
   - **Set alerts for similar roles** — lilac bell icon tile · copy · `Set up alerts` secondary button
   - **Share the role** — lilac share icon tile · copy · `Copy link` secondary button (copies the posting URL to clipboard)

4. **Footer line**: "Need to change something? **Reply to your confirmation email** — it goes straight to {RecruiterFirstName}."

The existing `CareersTopBar` and `CareersFooter` continue to wrap the page (they already do on the posting itself), so nothing changes about the page chrome.

## Dynamic data

| Placeholder | Source |
|---|---|
| `{FirstName}` | First token of the submitted candidate name; falls back to "there" |
| `{RoleName}` | `posting.title` |
| `{email}` | The email the candidate submitted |
| `{ReferenceID}` | Short ID derived from the new candidate/application row (format `{ROLE3}-{YYYY}-{NNN}-{INIT}-{4digits}`); falls back to the application UUID's first 8 chars uppercased if generation fails |
| `{RecruiterFirstName}` | Job's primary recruiter first name; falls back to "our team" |
| Step 2 name "Maya" | Same recruiter first name; falls back to "Our team" with rephrased sentence |
| `Within 48h` / `~ next week` / `~ 2–3 weeks` | Static for now |

No new tables. The reference ID is computed client-side from existing data (no schema change).

## Behavior

- After a successful submit, replace the page content (between top bar and footer) with the new confirmation screen instead of opening `ApplicationConfirmationDialog`.
- `Set up alerts` opens a lightweight email-capture popover (single input + submit) that writes to a new client-only state for now and shows a toast — wiring to a real alerts table is out of scope; the button is fully styled and functional in the UI.
- `Copy link` copies `window.location.href` (the posting URL) and shows a toast.
- The screen is reachable only after a real submit (state-driven, not a route), matching today's behavior.

## Technical notes

- **New file**: `src/components/careers/public/ApplicationSubmittedScreen.tsx` — pure presentational component receiving `{ firstName, roleName, email, referenceId, recruiterFirstName, postingUrl }`.
- **Edit**: `src/pages/PublicJobPosting.tsx`
  - Add `submittedMeta` state (`{ firstName, email, referenceId } | null`)
  - On success path (~line 556–563), populate `submittedMeta` instead of `setShowConfirmationDialog(true)`
  - When `submittedMeta` is set, render `<ApplicationSubmittedScreen … />` in place of the application form section (keep `CareersTopBar` + `CareersFooter` wrappers)
  - Remove `ApplicationConfirmationDialog` import + usage
- **Delete**: `src/components/candidates/ApplicationConfirmationDialog.tsx` (no other consumers per repo search)
- **Reference ID helper**: small util `src/utils/applicationReference.ts` — pure function `buildReferenceId({ roleTitle, candidateName, applicationId })`
- All colors via semantic tokens / existing public-careers palette (`#FAF7F2` page bg, `virgilio-purple` for accents, `success` for the green check, lilac `#EDE4FF` for icon tiles). Poppins for headline, Inter for body — already loaded.
- Mobile: hero text scales down (`text-h1-mobile`), action cards stack, timeline stays single column.

## Out of scope

- Persisting job alert subscriptions to a real table
- Email/Calendar deep links beyond "Copy link"
- Sending the reference ID inside the confirmation email (display-only for now)
- Animations beyond a subtle fade-in on mount
