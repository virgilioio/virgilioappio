

## Shareable scorecard URLs

### Goal
Make the scorecard view directly addressable so it can be linked, refreshed, and shared. Format:

```
/jobs/:jobId?candidate=:candidateId&scorecard=:scorecardId
```

When opening a stage that has no scorecard yet (new entry), use:

```
/jobs/:jobId?candidate=:candidateId&open=scorecard&stage=:stageInstanceId
```

The second form already exists for AI notification deep-links — we keep it for the "no scorecard yet" case and add the new `scorecard=:id` form for opening an existing one.

### Behavior
1. Opening any scorecard from the candidate profile (clicking a card in `ExpandableScoreDisplay` or the AI draft banner) writes `?scorecard=<id>` to the URL alongside `?candidate=<id>`.
2. Closing the scorecard removes only the `scorecard` / `open` / `stage` params and keeps the candidate sheet open with `?candidate=<id>`.
3. Closing the candidate sheet removes all three params (current behavior).
4. Loading the page with `?candidate=X&scorecard=Y` opens the candidate sheet and then the scorecard for ID Y on the correct stage automatically.
5. Browser back/forward navigates the URL stack: scorecard open → scorecard closed → sheet closed.

### File changes

**`src/pages/JobDetail.tsx`**
- Extend `updateCandidateUrl` (or add a sibling `updateScorecardUrl(scorecardId | null, stageId?)`) that writes/clears `scorecard`, `open`, `stage` while preserving `candidate`.
- Add reading `scorecard` query param in the existing URL effect (line ~566). When present, set new state `autoOpenScorecardId` and pass it into `<CandidateProfileSheet>`.
- Pass two new props down: `autoOpenScorecardId` and `onScorecardChange(scorecardId | null, stageInstanceId?)`.
- In the `onOpenChange={(open) => …}` of the sheet, also clear `scorecard` param when closing.

**`src/components/candidates/CandidateProfileSheet.tsx`**
- Accept `autoOpenScorecardId?: string | null` and `onScorecardChange?: (scorecardId: string | null, stageInstanceId?: string | null) => void`.
- New effect: when `autoOpenScorecardId` is set and `planStages` are loaded, look up the scorecard's stage from `useAllStageScorecards` results across all stages (or fetch the single row from `job_stage_scorecards` to get its `stage_instance_id`), then set `scoreStageInstId`, `scoreStageName`, `viewingScorecardId`, and open the sheet.
- In the existing `onOpenFullSheet` callbacks (lines ~1341), call `onScorecardChange(scorecardId, opt.jhsId)` so the URL is written when the user opens a scorecard from within the sheet.
- In the `ScorecardSheet`'s `onOpenChange`, when closing, call `onScorecardChange(null)` to drop the param.
- Keep the existing `autoOpenScorecard` + `autoOpenScorecardStageId` flow for the "create new scorecard for stage X" case (used by AI notification emails) — unchanged.

**`src/components/candidates/ScorecardSheet.tsx`**
- No prop changes needed; the parent already controls `open`. We rely on `onOpenChange` already wired in the parent.

### Edge cases
- `?scorecard=<id>` for a scorecard the user can't see (private + not author + not admin): silently ignore and just open the candidate sheet on the Scorecards tab. No error toast.
- `?scorecard=<id>` for a scorecard whose candidate doesn't match `?candidate=<id>` (link tampering): ignore the scorecard param, keep candidate sheet open.
- Refresh in the middle of an unsaved new-scorecard draft: covered by existing `?open=scorecard&stage=X` flow; we don't try to URL-persist unsaved draft state.

### Out of scope
- Path-style URL (`/jobs/X/candidates/Y/scorecards/Z`). Keep query params to preserve the existing tab/communications/offer query-string scheme already in use across the app (`?tab=communications`, `?tab=offer`).
- Linking to specific scorecard tabs inside the scorecard sheet.
- Updating every place that links to a candidate (`StaleCandidates`, `PendingActivities`, etc.) — they already use the same query-param scheme and continue to work.

### Verification
1. Open a candidate → click a submitted scorecard. URL becomes `?candidate=X&scorecard=Y`. Refresh — same scorecard reopens.
2. Copy the URL, paste in a new tab — candidate sheet opens, then scorecard opens on the correct stage.
3. Close scorecard → URL drops to `?candidate=X`, sheet stays open. Back button reopens the scorecard.
4. AI notification link `?candidate=X&open=scorecard&stage=S` still works (creates/opens a draft on stage S).
5. Linking to a scorecard the current user lacks visibility for opens the candidate sheet only, no error.

