# Submitted scorecard header polish + Key takeaways label

Three small visual edits in the Scorecards tab on the in-job candidate profile to match the reference screenshot.

## Scope

1. **`src/components/candidates/CandidateProfileSheet.tsx`** — pass the submission timestamp into each row:
   - In the `submittedScorecardRows` mapping, add `submittedAt: s.updated_at`. (We use `updated_at` because that is the moment the panelist saved/submitted the scorecard; the schema has no separate `submitted_at` column.)

2. **`src/components/candidates/profile/tabs/ScorecardsTabContent.tsx`**
   - Extend `SubmittedScorecardRow` with `submittedAt?: string | null`.
   - In `PanelistRow`, change the secondary meta line (currently shows only `p.meta`) to render:  
     `Mon DD · {stage name}` — e.g. `May 12 · Onsite Day 1`.  
     Date formatted with `new Date(submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })`; falls back gracefully if either piece is missing (just show whichever is present). Same typography as today (Inter 11.5px, `#8B8F9E`).
   - The verdict Badge at top-right of the row already renders the overall verdict — no change.
   - Rename the small uppercase label on the feedback box from **WRITTEN FEEDBACK** to **KEY TAKEAWAYS** (the underlying field is `general_overview`, which the scorecard editor labels "Key takeaways" via `KeyTakeawaysCard`). Quote characters and content rendering stay the same.

No other files, no data/hook changes (the API already returns `updated_at` on `ScorecardWithAuthor`).

## Out of scope

- Storing/displaying a separate `submitted_at` column.
- Reformatting the date to the global concise `Xd` style — the reference shows an explicit calendar date, which reads better for an interview event.
- Any change to the verdict badge, per-question score cards, or summary sidebar.
