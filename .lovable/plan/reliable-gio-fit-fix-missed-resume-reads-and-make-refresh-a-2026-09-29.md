# Reliable Gio Fit: fix missed resume reads and make Refresh a full re-analysis

## What happened with Pamela Aguilar

- She was added on 23 Sept with her resume ("Pamela Aguilar - PM - PL.pdf"). The file was saved correctly as her resume.
- Gio never read it. Her profile still says "waiting to be read", with no summary, no skills and no work experience, and there is no record of a read ever being started.
- **Why:** when a candidate is added from the Add candidate sheet, the read is only started if the browser pulled text out of the file while the form was open. If that step came back empty (common with some PDFs), or the file was attached in a way that skipped it, the resume was saved but never sent to Gio. Nothing retries it later.
- Gio Fit then scored her on an almost empty profile, which is why she got 37 and why no job history shows up. Gio Fit notes that "a resume exists" but never reads what's in it, so it depends completely on that earlier read.

**Pamela isn't the only one.** 83 candidates have a resume on file that was never read (34 of them added in the last 30 days), and 13 more had a read that failed. All of them are being scored without their work history.

## What will change

1. **Adding a candidate always reads the resume.** Once the resume is saved, Gio reads it from the stored file, whether or not the browser managed to pull text out of it. This covers new candidates, candidates added to a job, and bulk uploads.
2. **Refresh in the Gio Fit tab becomes a full re-analysis.** Pressing Refresh will:
   - re-read the current resume and rewrite the summary, skills, experience and education from it;
   - wait for that to finish;
   - then score the candidate using everything on their profile: resume content, experience, education, skills, salary expectations and all submitted scorecards for this job.
   The loading steps stay the same, with one extra step at the start: "Reading the résumé".
3. **Gio Fit reads the resume text itself.** The scoring gets the actual resume text as evidence, so a weak or partial earlier read can't drag the score down.
4. **Catch-up for existing candidates.** The 96 unread or failed resumes are re-read a few at a time in the background. Each candidate is re-scored only on jobs where they are still active. Pamela and the Senior Project Manager - Services pipeline go first.

## Technical details

- `CandidateFormSheet.handlePostSubmitActions` (and the bulk upload flow): after the resume attachment is inserted, always call `triggerBackgroundEnrichment(candidateId, capturedResumeText || undefined, name, { rescoreAllJobs: true })`. `enrich-candidate-profile` already falls back to downloading the resume from storage when no text is passed.
- Refresh (`useCandidateFitInsights.refreshInsights`): call `enrich-candidate-profile` in a new synchronous mode (`{ candidateId, jobId, wait: true }`) that awaits the extraction and returns its status. Then call `analyze-candidate-fit`. If there's no usable resume text (`not_possible`), score anyway and say "Résumé couldn't be read" in the progress strip. The existing cancel/abort still works.
- `analyze-candidate-fit`: load the latest resume attachment's text (same pdf/docx extraction as the enrich function, moved into `_shared/resumeText.ts`) and add it to the prompt, capped at about 12k characters. Scorecards are already loaded; confirm submitted scorecards are passed in full.
- Backfill: a new bounded job that processes 5 candidates per run and records progress by setting `enrichment_status`, so re-runs skip candidates already done. It is started by hand once (no recurring schedule) and stops early on 402/403/429 credit or rate-limit errors.
- No schema changes are needed.
