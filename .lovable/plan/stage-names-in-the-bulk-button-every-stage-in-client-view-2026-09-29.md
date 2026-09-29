# Stage names in the bulk button + every stage in Client view

## What we found (job: Senior Project Manager - Services)
Pipeline stages, in order:
1. Application Review
2. **Hiring Manager Review** (the job's own name for this stage; the underlying stage is "Final Candidate Review") — stage type "Application"
3. Recruiter Screening
4. Hiring Manager Interview
5. Peer Interview
6. Panel Interview

- **Bulk button name:** since the last fix, the button uses the same name the pipeline shows, so it now reads "Move to Hiring Manager Review". It follows whatever name you give the stage in Setup, so if you rename it to "Final Candidate Review" the button changes to match. No extra change is needed for the name. The plan only confirms it with a check.
- **Missing stage in Client view:** stage 2's type is "Application". The Client view setup and the public board treat any "Application" stage as part of Application review, not as a recruiting stage. So it's missing from the stage picker, and candidates in it are filed under the Application review tab on the client link.

## The fix
- Only the fixed Application review stage, Offer and Onboarding stay outside the stage picker, because they have their own sections. Every other stage in the job, including "Application"-type stages like Hiring Manager Review, shows up in Client view, where you can turn it on or off.
- On the public client link, candidates in those stages appear on the Recruiting board under the right stage column, not under Application review.
- Existing client links stay as they are. The newly available stage starts off, and you turn it on when you want to share it.

## Technical details
- `src/hooks/useJobPipelineShare.ts`: `NON_RECRUITING_STAGE_TYPES` → `application_review`, `offer`, `onboarding` (drop `application`).
- `supabase/functions/pipeline-public/index.ts`: same set change for `NON_RECRUITING`; `sectionFor()` maps only `application_review` to the application section; redeploy `pipeline-public`.
- Check `dossier-public` for the same `application` assumption and align it.
- Check that the bulk label shows the name the pipeline displays (`custom_stage_name || stage_name`). The stage-map query already uses this.
