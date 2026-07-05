Fix three real issues with the Scorecard-required flow: (1) candidate name missing in the reminder email, (2) "Submit scorecard" CTA lands on the job page instead of the actual scorecard, (3) an interviewer sees "Request scorecard" for their own pending scorecard when they should see "Complete scorecard".

## 1. Fix candidate name in reminder email

**Files:** `supabase/functions/request-scorecard/index.ts`, `supabase/functions/send-scorecard-reminders/index.ts`, `supabase/functions/_shared/scorecardReminderEmail.ts`

- Harden the candidate name resolution in both functions:
  - Select `first_name, last_name, candidate_name, full_name` (if present) from `candidates`.
  - Build `candidate_full_name` as first non-empty of: `candidate_name`, `first_name + last_name`, `first_name`, `last_name`, otherwise `"the candidate"`.
  - Build `candidate_first_name` similarly.
- Include the candidate's full name explicitly in the headline (not just first name) so it always appears in the body — e.g. `Your feedback on {{candidate_full_name}} is holding up the pipeline.` and keep first name in the intro line.
- Keep subject/preheader referencing the full name.

## 2. Route "Submit scorecard" CTA directly to the candidate's Scorecards tab

**Files:** `supabase/functions/request-scorecard/index.ts`, `supabase/functions/send-scorecard-reminders/index.ts`, `src/components/candidates/CandidateProfileSheet.tsx`

- Change the `scorecard_url` in both edge functions from `/jobs/{jobId}?openCandidate={candidateId}&tab=scorecards` to the real profile route:
  `${appUrl}/jobs/{jobId}/candidates/{candidateId}?tab=scorecards&focus=my-scorecard`.
- In `CandidateProfileSheet.tsx`, extend the initial-tab effect (around line 508) to also honor `tab=scorecards`, `tab=overview`, `tab=comments`, `tab=offer` — currently only `communications`/`emails`/`activity` are handled. Set `activeTab = 'scorecards'` when the URL param says so.
- When `focus=my-scorecard` is present, scroll to and expand the current user's pending scorecard form on mount (best-effort: pass an `initialFocusUserId` prop into the Scorecards tab content that matches on `currentUserId`).

## 3. Self vs. others: "Complete scorecard" instead of "Request scorecard"

**Files:** `src/components/candidates/profile/StageScorecardsCard.tsx`, `src/components/candidates/profile/tabs/ScorecardsTabContent.tsx`, `src/components/candidates/profile/tabs/SidebarRouter.tsx`, `src/components/candidates/CandidateProfileSheet.tsx`

- Plumb `currentUserId` into all three components (already present in `StageScorecardsCard`; add to `ScorecardsTabContent` and the pending-block section of `SidebarRouter`).
- For each pending row where `row.userId === currentUserId`:
  - Replace the "Request" / "Requested Xd ago" button with a **primary** `Button` labeled **"Complete scorecard"** (icon: `PenLine` from lucide).
  - Clicking it switches `activeTab` to `'scorecards'` and scrolls to that interviewer's scorecard form (reuse the same focus mechanism from Fix #2).
  - Hide the row's "Requested Xd ago" hint for self (irrelevant — you can't nudge yourself).
- For the "Request all" button in the banner: if the only remaining pending interviewer is the current user, swap the banner CTA to "Complete scorecard" too; otherwise keep "Request all" but ensure it never triggers a self-email in the edge function.
- Backend guard: in `request-scorecard/index.ts`, filter out the caller's own `user_id` from `targets` (resolve the caller from the JWT via `supabase.auth.getUser` using the request `Authorization` header). Return `{ ok: true, skipped_self: 1 }` so the UI can react gracefully.

## Technical details

- Route param handling in `CandidateProfileSheet` uses `window.location.search`; extend the switch, don't restructure.
- Self-detection uses the existing `currentUserId` already loaded via `useAuth`/`useUserProfile` in `CandidateProfileSheet` — pass it down as a prop.
- Scroll target: give each pending scorecard form a stable `id={`scorecard-form-${userId}`}` and, when `focus=my-scorecard` or the "Complete scorecard" button is clicked, call `document.getElementById(...)?.scrollIntoView({ behavior: 'smooth', block: 'center' })` after the tab switch (next tick via `requestAnimationFrame`).
- No new visual system: reuse existing `Button` variants (`primary` for "Complete scorecard", keep `purple` for "Request"), existing `Badge`, existing card styling.
- No new email service — same shared template, same Resend pipeline.
- Edge functions redeploy: `request-scorecard`, `send-scorecard-reminders`.

## What NOT to do

- Don't add a new top-level `/scorecards/:id` route — the candidate profile already owns scorecards, and adding a param + focus keeps deep-links stable.
- Don't rewrite the email template shell — only tweak the headline copy and merge-var resolution.
- Don't change the Scorecards tab layout, AI synthesis card, or Configure-Stage toggle behavior.
