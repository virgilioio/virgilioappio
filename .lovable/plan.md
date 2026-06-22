I found the actual problem: the live route `/candidates/:candidateId` is `src/pages/IndependentCandidateProfile.tsx`, not the previously edited `IndependentCandidateProfileSheet.tsx`. That route still uses `max-w-[1280px]` and `IndependentCandidateForm`, which is why the width and edit behavior did not change.

Plan:

1. Update `src/pages/IndependentCandidateProfile.tsx` width/layout to match the in-job candidate profile page:
   - Replace the `min-h-screen` + `max-w-[1280px] px-6 py-6` page shell.
   - Use the same fixed app viewport pattern as `CandidateProfileSheet asPage`.
   - Put the hero in the same `layout-container` header band.
   - Put the content grid in the same scroll area using `layout-container max-w-[1400px]`.

2. Replace the independent edit dialog/form:
   - Remove `IndependentCandidateForm` from this profile page.
   - Use the shared `CandidateFormSheet` component instead, the same edit sheet used by the in-job candidate profile.
   - Keep every existing Edit button wired to `setIsFormOpen(true)`, but make that state open the shared sheet.

3. Wire saving through the existing independent candidate update logic:
   - Pass the independent candidate as the sheet `candidate` prop.
   - On submit, call `updateCandidate(candidate.id, data)` and close the sheet.
   - Preserve the single-column `candidate_name` behavior already handled by `CandidateFormSheet`.

4. Verify after implementation:
   - Check the independent profile route renders with the same container widths as the in-job profile.
   - Click Overview > Contact information > Edit and confirm the shared side sheet opens, not the old dialog.