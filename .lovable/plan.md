# Fix: "Moved on from this stage" when opening candidates on the client board

## What's happening
On the client board, opening a candidate fetches their dossier. If that fetch fails for any reason, the board shows one catch-all toast — "This candidate has moved on from this stage" — and sends the client back. So the toast appears for candidates who haven't moved at all.

From the code, the most likely cause is that these candidates don't have a Gio Fit analysis yet. The dossier service reports "unavailable" for anyone without one, and the board reads that as "moved on". "Awaiting your review" candidates are often newer, so they're the ones most likely to have no score yet. **This isn't confirmed yet**, so step 1 is to check it.

## Plan
1. **Confirm the cause.** Briefly turn the test link on, open each "Awaiting your review" candidate through the service, and record why each one fails (no Fit analysis, or something else). Then turn the link off again.
2. **Separate the reasons.** The service will return a specific reason (not in a visible stage, no dossier yet, or role closed) so the board no longer treats every failure the same way.
3. **Candidates without a dossier still open.** Instead of bouncing the client back, open a simple client-ready profile page with the same header, stage, days in stage, experience, skills and (if allowed) scorecards. Where the fit score would go, it will say "Assessment in progress". The client's Request interview / Not a fit buttons will still work.
4. **Keep the "moved on" toast only for real moves**, meaning the candidate is no longer in a stage the client can see.
5. **Verify** in a browser on the test board: every "Awaiting your review" card opens, and a candidate who really moved still shows the toast. Turn the test link off afterwards.

## Technical details
- `supabase/functions/dossier-public/index.ts` (`internal_resolve` only): when there's no `ai_fit_analysis`, return `state: "no_assessment"` with the client-ready candidate, experience and scorecard payload, and no score block. The public `/d/:token` behaviour stays the same.
- `supabase/functions/pipeline-public/index.ts`: pass `no_assessment` through with the same pipeline display rules (initials only, employer, scorecards, responses). Return `{state:"gone"}` for a slug that isn't found, instead of a bare 404.
- `src/pages/PublicDossier.tsx` / `PublicDossierBody.tsx`: render the no-score variant. Call `onGone` only for `gone`.
- No database changes.
