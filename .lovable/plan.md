

# Fix: Empty Key Takeaways on Scorecard Reopen + Restore Click-to-Open UX

## Root Cause: Empty Key Takeaways

There is a **race condition** in `ScorecardSheet.tsx`. When saving an AI-draft scorecard:

1. `handleSave` calls `await onSubmit(rating, overview)` (line 573)
2. Parent's `onSubmit` calls `upsertMyScorecard` then `refetchScorecards()` — refetch happens **before** `is_ai_draft` is cleared
3. Back in `ScorecardSheet`, line 637-641: `is_ai_draft` is set to `false` in DB — **after** the parent already refetched
4. Local state (`myScorecardsByStage`) still has `is_ai_draft: true`
5. When reopening, the init effect (line 240/254) sees `existing?.is_ai_draft === true` and forces `effectiveBaseOverview = ""` — **erasing the saved notes**

```text
Timeline:
  onSubmit() → parent refetches (is_ai_draft still true in DB)
       ↓
  ScorecardSheet sets is_ai_draft=false in DB (too late, parent already cached old state)
       ↓
  User reopens → existing.is_ai_draft=true → overview forced to ""
```

## Root Cause: Missing Click-to-Open on Scorecard Cards

The "View Scorecard" button was added as a workaround, but the user expects to click on scorecard cards in the `ExpandableScoreDisplay` to reopen them — which was the original UX. The `onOpenFullSheet` callback already exists and works for other users' scorecards but the user's own card doesn't trigger it prominently enough.

## Fix Plan

### 1. Fix the race condition — `ScorecardSheet.tsx` (lines 636-642)

Move the `is_ai_draft: false` DB update to **before** calling `onSubmit`, so when the parent refetches, the flag is already cleared:

```tsx
// In handleSave, BEFORE calling onSubmit:
if (isAiDraft && existing?.id) {
  await supabase
    .from('job_stage_scorecards')
    .update({ is_ai_draft: false })
    .eq('id', existing.id);
}

await onSubmit(rating, overview);
// Remove the old is_ai_draft update block after onSubmit
```

### 2. Make scorecard cards clickable — `ExpandableScoreDisplay.tsx`

Make the entire scorecard card clickable to open the full ScorecardSheet via `onOpenFullSheet`. Add a chevron icon to indicate it is clickable. Remove the buried "Read more →" link since the whole card now opens the sheet.

### 3. Remove "View Scorecard" button — `CandidateProfileSheet.tsx` (lines 1106-1120)

Remove the standalone "View Scorecard" button since the scorecard cards now serve as the entry point. Keep the "Submit Scorecard" / "AI Notes" button for stages where no scorecard exists yet.

