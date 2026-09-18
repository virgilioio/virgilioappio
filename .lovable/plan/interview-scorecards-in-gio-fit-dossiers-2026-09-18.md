# Interview scorecards in Gio Fit dossiers

## What will change
- Add one reusable interview-scorecards section between Identified skills and Experience.
- Show submitted scorecards newest-first, with verbatim Key Takeaways, rating, interviewer, date, and stage.
- Keep rows collapsed by default; allow one open row at a time.
- In Internal view, show per-area ratings after expansion plus outstanding interviewer names.
- In Client-ready view, keep every submitted rating and takeaway, while removing area ratings and pending-work details.
- Hide the section completely when there are no submitted scorecards.

## Public dossier
- Extend the existing public dossier response with a limited scorecard shape only: interviewer display details, stage, submission date, overall rating, and verbatim takeaways.
- Do not send draft scorecards, pending assignments, or per-area calibration to the public browser.
- Render the same client-ready scorecard section in the shared dossier.

## PDF
- Pass the same normalized scorecard data into the existing shared print document.
- Begin scorecards on their own page after Summary and Identified skills, printing full takeaways without accordions.
- Keep each scorecard together where it fits; allow extra scorecard-only pages when content requires them.
- Omit area ratings from client-ready PDFs and retain them internally.
- Continue using the existing measured pagination source so preview counts and all page footers agree.

## Technical details
- Reuse existing `job_stage_scorecards`, question responses, stage names, profile titles, and interviewer assignments; no schema changes or generated content.
- Treat a submitted scorecard as a non-AI-draft row with a valid overall rating and non-empty Key Takeaways.
- Convert stored rich text to safe plain text, preserving paragraph breaks for expanded web rows and PDF output.
- Verify type safety, current build health, public payload redaction, and print pagination behavior.
