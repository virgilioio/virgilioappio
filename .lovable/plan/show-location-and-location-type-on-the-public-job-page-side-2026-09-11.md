# Show Location and Location type on the public job page side card

## What's happening

The side summary card on a public job page has a Location row but no Location type (Remote / Hybrid / On-site) row at all — so the work model never appears there.

The Location row also only reads the value saved on the posting itself. For 5 of the 12 currently live postings that value is empty even though the job record has a location, so those pages show no Location line.

## What will change

In the right-hand summary card on the public job page:

- Add a **Work model** row showing Remote, Hybrid or On-site.
- Make the **Location** row fall back to the job's own location when the posting doesn't have one, so it stops disappearing.
- Same fallback for the location chips at the top of the page, so header and side card always agree.

Row order in the card: Posted, Location, Work model, Type, Compensation, Variable comp, Reports to, Ref. Rows with no value stay hidden, as today.

No changes to how postings are edited or saved, and nothing else on the page moves.

## Technical detail

- `src/pages/PublicJobPosting.tsx`
  - Extend the job-level fetch to also read `jobs.location` and `jobs.work_mode` alongside the salary fields already read there.
  - In the `details` memo, `location: d.location || job.location || null` and `locationType: d.location_type || job.work_mode || null`.
  - Add `{ label: 'Work model', value: formatLabel(details.locationType) }` to `summaryRows` right after Location.
- No database, schema, or write-path changes; `JobAsideSummary` already skips empty rows.
