# Public dossier client actions by stage

## What will change
- Resolve one of six public dossier states on the server from the candidate–job association, current hiring stage, latest client decision, interview booking, and offer/hire dates.
- Keep rejected and withdrawn candidates on the unavailable page, while preserving access through offer and hire even when a job is no longer open.
- Rebuild the provenance row with shared small buttons in the required order for the awaiting state; every later state gets a factual badge, direct PDF download, and a clear next-step note.
- Add the offer and hired banners above the dossier card content, without recruiter controls or compensation.
- Make client decisions optimistic but reversible on failure, and refuse a second decision server-side while preserving recruiter notifications and email.

## Technical details
- Extend the public payload with an explicit stage object and only the dates/text needed by the client-ready page.
- Derive stage precedence server-side: deactivated terminal states first, then hired, offer, interviewing, persisted client decision, awaiting.
- Reuse the shared `Button`, `Badge`, and public-safe banner presentation; keep all internal controls absent.
- Add database-level one-decision-per-share enforcement if existing data permits, so concurrent duplicate submissions are also blocked.
- Validate the edge function, build, direct PDF path, and representative responsive states.
